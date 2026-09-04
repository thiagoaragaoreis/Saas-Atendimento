import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode";
import pino from "pino";
import { prisma } from "./lib/prisma";
import { getIo } from "./socket/io";

const AUTH_FOLDER = "auth_info_baileys";
const logger = pino({ level: "silent" });

let sock: WASocket | null = null;

async function getDefaultCompanyId(): Promise<number> {
  const company = await prisma.company.findFirst({ orderBy: { id: "asc" } });
  if (company) return company.id;
  const created = await prisma.company.create({ data: { name: "Clinica Padrao" } });
  return created.id;
}

function jidToNumber(jid: string): string {
  return jid.replace(/@s\.whatsapp\.net$/, "").replace(/@g\.us$/, "");
}

async function upsertContactAndTicket(companyId: number, number: string, name: string) {
  const contact = await prisma.contact.upsert({
    where: { number_companyId: { number, companyId } },
    update: { name },
    create: { number, name, companyId },
  });

  let ticket = await prisma.ticket.findFirst({
    where: { contactId: contact.id, companyId, status: { not: "closed" } },
    orderBy: { createdAt: "desc" },
  });

  if (!ticket) {
    ticket = await prisma.ticket.create({
      data: { contactId: contact.id, companyId, status: "open" },
    });
  }

  return { contact, ticket };
}

function buildQueueMenuText(queues: { name: string; menuOption: string }[]): string {
  const options = queues.map((q) => `${q.menuOption} - ${q.name}`).join("\n");
  return `Ola! Para qual area voce deseja falar?\n${options}\n\nDigite o numero da opcao desejada.`;
}

// Envia texto pelo WhatsApp e ja registra como mensagem do ticket (fromMe).
// Falhas de envio sao logadas mas nao interrompem o fluxo (a mensagem fica
// registrada no historico mesmo que o WhatsApp esteja temporariamente fora).
async function sendBotMessage(ticketId: number, number: string, text: string): Promise<void> {
  try {
    await sendWhatsappMessage(number, text);
  } catch (err) {
    console.error("[wbot] Falha ao enviar mensagem automatica:", err);
  }

  const message = await prisma.message.create({
    data: { body: text, fromMe: true, read: true, ticketId },
  });
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: { contact: true } });
  getIo().emit("ticket:message", { ticket, message });
}

// Tenta confirmar uma consulta pendente de lembrete (paciente respondeu "1"
// apos o lembrete enviado por ReminderJob). Retorna true se confirmou algo,
// para o chamador saber que essa mensagem ja foi tratada e nao deve ser
// interpretada como escolha de fila.
async function tryConfirmAppointment(contactId: number, body: string): Promise<boolean> {
  if (body.trim() !== "1") return false;

  const appointment = await prisma.appointment.findFirst({
    where: { contactId, status: "scheduled", reminderSentAt: { not: null } },
    orderBy: { date: "asc" },
  });

  if (!appointment) return false;

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "confirmed" },
    include: { contact: true },
  });

  getIo().emit("appointment:update", updated);
  return true;
}

// Processa uma mensagem recebida de um contato: cria/atualiza contato e
// ticket, trata confirmacao de consulta e o menu automatico de filas.
// Isolada do binding do Baileys para poder ser testada diretamente.
export async function handleIncomingMessage(
  companyId: number,
  number: string,
  name: string,
  body: string
): Promise<void> {
  const { contact, ticket } = await upsertContactAndTicket(companyId, number, name);

  const message = await prisma.message.create({
    data: { body, fromMe: false, ticketId: ticket.id },
  });

  let updatedTicket = await prisma.ticket.update({
    where: { id: ticket.id },
    data: { lastMessage: body, unreadMessages: { increment: 1 } },
    include: { contact: true },
  });

  getIo().emit("ticket:message", { ticket: updatedTicket, message });
  getIo().emit("ticket:update", updatedTicket);

  const confirmedAppointment = await tryConfirmAppointment(contact.id, body);
  if (confirmedAppointment) return;

  if (updatedTicket.queueId) return; // ja esta em uma fila, segue fluxo normal de chat

  const queues = await prisma.queue.findMany({ where: { companyId }, orderBy: { menuOption: "asc" } });
  if (queues.length === 0) return; // empresa nao configurou filas: comportamento antigo (sem menu)

  const chosen = queues.find((q) => q.menuOption === body.trim());

  if (chosen) {
    updatedTicket = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { queueId: chosen.id },
      include: { contact: true },
    });
    getIo().emit("ticket:update", updatedTicket);
    await sendBotMessage(
      ticket.id,
      number,
      `Voce foi direcionado para *${chosen.name}*. Em breve um atendente ira te atender.`
    );
  } else {
    await sendBotMessage(ticket.id, number, buildQueueMenuText(queues));
  }
}

export async function startWbot(): Promise<void> {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

  sock = makeWASocket({
    auth: state,
    logger,
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      const qrImage = await qrcode.toDataURL(qr);
      getIo().emit("whatsapp:qr", { qr: qrImage });
    }

    if (connection === "open") {
      getIo().emit("whatsapp:status", { status: "connected" });
      console.log("[wbot] Conectado ao WhatsApp");
    }

    if (connection === "close") {
      getIo().emit("whatsapp:status", { status: "disconnected" });
      const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log("[wbot] Conexao encerrada. Reconectar?", shouldReconnect);
      if (shouldReconnect) {
        startWbot();
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const jid = msg.key.remoteJid;
      if (!jid || jid.endsWith("@g.us") || jid === "status@broadcast") continue;

      const body =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        "[mensagem de midia]";

      const number = jidToNumber(jid);
      const name = msg.pushName || number;

      try {
        const companyId = await getDefaultCompanyId();
        await handleIncomingMessage(companyId, number, name, body);
      } catch (err) {
        console.error("[wbot] Falha ao processar mensagem recebida:", err);
      }
    }
  });
}

export async function sendWhatsappMessage(number: string, text: string): Promise<void> {
  if (!sock) throw new Error("wbot nao esta conectado");
  const jid = number.includes("@") ? number : `${number}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text });
}

export function getSock(): WASocket | null {
  return sock;
}
