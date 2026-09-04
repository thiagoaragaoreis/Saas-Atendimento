import { Router } from "express";
import { prisma } from "../lib/prisma";
import { getIo } from "../socket/io";

const router = Router();

// GET /api/tickets?status=open&search=texto&queueId=1
router.get("/", async (req, res) => {
  const { status, search, queueId } = req.query as {
    status?: string;
    search?: string;
    queueId?: string;
  };
  const currentUser = req.currentUser!;

  const queueFilter =
    currentUser.role === "admin"
      ? queueId
        ? { queueId: Number(queueId) }
        : {}
      : { queueId: { in: queueId ? [Number(queueId)].filter((id) => currentUser.queueIds.includes(id)) : currentUser.queueIds } };

  const tickets = await prisma.ticket.findMany({
    where: {
      companyId: currentUser.companyId,
      ...(status === "all" ? {} : status ? { status } : { status: { not: "closed" } }),
      ...queueFilter,
      ...(search
        ? {
            contact: {
              OR: [{ name: { contains: search } }, { number: { contains: search } }],
            },
          }
        : {}),
    },
    include: { contact: true, queue: true },
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

// PUT /api/tickets/:id  { status, queueId }
router.put("/:id", async (req, res) => {
  const ticketId = Number(req.params.id);
  const { status, queueId } = req.body as { status?: string; queueId?: number };

  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      ...(status ? { status, ...(status !== "closed" ? { unreadMessages: 0 } : {}) } : {}),
      ...(queueId !== undefined ? { queueId } : {}),
    },
    include: { contact: true, queue: true },
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
    include: { contact: true, queue: true },
  });

  getIo().emit("ticket:update", ticket);
  res.json(ticket);
});

export default router;
