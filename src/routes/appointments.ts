import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/appointments?contactId=1
router.get("/", async (req, res) => {
  const { contactId, from, to } = req.query as {
    contactId?: string;
    from?: string;
    to?: string;
  };

  const appointments = await prisma.appointment.findMany({
    where: {
      ...(contactId ? { contactId: Number(contactId) } : {}),
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    include: { contact: true },
    orderBy: { date: "asc" },
  });

  res.json(appointments);
});

// POST /api/appointments  { contactId, companyId, date, notes }
router.post("/", async (req, res) => {
  const { contactId, companyId, date, notes } = req.body as {
    contactId: number;
    companyId: number;
    date: string;
    notes?: string;
  };

  if (!contactId || !companyId || !date) {
    return res.status(400).json({ error: "contactId, companyId e date sao obrigatorios" });
  }

  const appointment = await prisma.appointment.create({
    data: {
      contactId: Number(contactId),
      companyId: Number(companyId),
      date: new Date(date),
      notes,
    },
    include: { contact: true },
  });

  res.status(201).json(appointment);
});

// PUT /api/appointments/:id  { status, date, notes }
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { status, date, notes } = req.body as {
    status?: string;
    date?: string;
    notes?: string;
  };

  const appointment = await prisma.appointment.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(date ? { date: new Date(date) } : {}),
      ...(notes !== undefined ? { notes } : {}),
    },
    include: { contact: true },
  });

  res.json(appointment);
});

// DELETE /api/appointments/:id
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  await prisma.appointment.delete({ where: { id } });
  res.status(204).send();
});

export default router;
