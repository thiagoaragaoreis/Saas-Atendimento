import { Router } from "express";
import { prisma } from "../lib/prisma";
import { getIo } from "../socket/io";

const router = Router();

// GET /api/tickets?status=open&search=texto
router.get("/", async (req, res) => {
  const { status, search } = req.query as { status?: string; search?: string };

  const tickets = await prisma.ticket.findMany({
    where: {
      ...(status && status !== "all" ? { status } : { status: { not: "closed" } }),
      ...(search
        ? {
            contact: {
              OR: [
                { name: { contains: search } },
                { number: { contains: search } },
              ],
            },
          }
        : {}),
    },
    include: { contact: true },
    orderBy: { updatedAt: "desc" },
  });

  res.json(tickets);
});

// GET /api/tickets/:id/messages
router.get("/:id/messages", async (req, res) => {
  const ticketId = Number(req.params.id);

  const messages = await prisma.message.findMany({
    where: { ticketId },
    orderBy: { createdAt: "asc" },
  });

  res.json(messages);
});

// PUT /api/tickets/:id  { status }
router.put("/:id", async (req, res) => {
  const ticketId = Number(req.params.id);
  const { status } = req.body as { status: string };

  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data: { status, ...(status !== "closed" ? { unreadMessages: 0 } : {}) },
    include: { contact: true },
  });

  getIo().emit("ticket:update", ticket);
  res.json(ticket);
});

// POST /api/tickets/:id/read
router.post("/:id/read", async (req, res) => {
  const ticketId = Number(req.params.id);

  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data: { unreadMessages: 0 },
    include: { contact: true },
  });

  getIo().emit("ticket:update", ticket);
  res.json(ticket);
});

export default router;
