import { Router } from "express";
import { prisma } from "../lib/prisma";
import { getIo } from "../socket/io";
import { sendWhatsappMessage } from "../wbot";

const router = Router();

// POST /api/enviar  { ticketId, body }
router.post("/enviar", async (req, res) => {
  const { ticketId, body } = req.body as { ticketId: number; body: string };

  if (!ticketId || !body) {
    return res.status(400).json({ error: "ticketId e body sao obrigatorios" });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: Number(ticketId) },
    include: { contact: true },
  });

  if (!ticket) {
    return res.status(404).json({ error: "Ticket nao encontrado" });
  }

  try {
    await sendWhatsappMessage(ticket.contact.number, body);
  } catch (err) {
    console.error("[api/enviar] Falha ao enviar mensagem no WhatsApp:", err);
    return res.status(502).json({ error: "Falha ao enviar mensagem no WhatsApp" });
  }

  const message = await prisma.message.create({
    data: { body, fromMe: true, ticketId: ticket.id, read: true },
  });

  const updatedTicket = await prisma.ticket.update({
    where: { id: ticket.id },
    data: { lastMessage: body, status: "open" },
    include: { contact: true },
  });

  getIo().emit("ticket:message", { ticket: updatedTicket, message });
  getIo().emit("ticket:update", updatedTicket);

  res.status(201).json(message);
});

export default router;
