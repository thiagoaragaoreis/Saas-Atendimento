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

async function upsertContactAndTicket(number: string, name: string) {
  const companyId = await getDefaultCompanyId();

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

      const { ticket, contact } = await upsertContactAndTicket(number, name);

      const message = await prisma.message.create({
        data: { body, fromMe: false, ticketId: ticket.id },
      });

      if (body.trim() === "1") {
        await confirmPendingAppointment(contact.id);
      }

      const updatedTicket = await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          lastMessage: body,
          unreadMessages: { increment: 1 },
        },
        include: { contact: true },
      });

      getIo().emit("ticket:message", { ticket: updatedTicket, message });
      getIo().emit("ticket:update", updatedTicket);
    }
  });
}

async function confirmPendingAppointment(contactId: number): Promise<void> {
  const appointment = await prisma.appointment.findFirst({
    where: { contactId, status: "scheduled", reminderSentAt: { not: null } },
    orderBy: { date: "asc" },
  });

  if (!appointment) return;

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "confirmed" },
    include: { contact: true },
  });

  getIo().emit("appointment:update", updated);
}

export async function sendWhatsappMessage(number: string, text: string): Promise<void> {
  if (!sock) throw new Error("wbot nao esta conectado");
  const jid = number.includes("@") ? number : `${number}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text });
}

export function getSock(): WASocket | null {
  return sock;
}
