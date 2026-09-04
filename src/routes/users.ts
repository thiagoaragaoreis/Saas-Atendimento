import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { requireAdmin } from "../middleware/currentUser";

const router = Router();

router.use(requireAdmin);

function serialize(user: {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
  queues: { id: number; name: string }[];
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    queues: user.queues,
  };
}

// GET /api/users
router.get("/", async (req, res) => {
  const users = await prisma.user.findMany({
    where: { companyId: req.currentUser!.companyId },
    include: { queues: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
  res.json(users.map(serialize));
});

// POST /api/users  { name, email, password, role, queueIds }
router.post("/", async (req, res) => {
  const { name, email, password, role, queueIds } = req.body as {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
    queueIds?: number[];
  };

  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: "Nome, e-mail e senha sao obrigatorios." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres." });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        role: role === "admin" ? "admin" : "attendant",
        companyId: req.currentUser!.companyId,
        queues: { connect: (queueIds || []).map((id) => ({ id })) },
      },
      include: { queues: { select: { id: true, name: true } } },
    });
    res.status(201).json(serialize(user));
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Ja existe um usuario com esse e-mail." });
    }
    throw err;
  }
});

// PUT /api/users/:id  { name, email, role, queueIds, password? }
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, email, role, queueIds, password } = req.body as {
    name?: string;
    email?: string;
    role?: string;
    queueIds?: number[];
    password?: string;
  };

  if (password && password.length < 6) {
    return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres." });
  }

  if (role && role !== "admin" && id === req.currentUser!.id) {
    const adminCount = await prisma.user.count({
      where: { companyId: req.currentUser!.companyId, role: "admin" },
    });
    if (adminCount <= 1) {
      return res.status(400).json({ error: "Voce nao pode remover o unico administrador." });
    }
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(name?.trim() ? { name: name.trim() } : {}),
        ...(email?.trim() ? { email: email.trim().toLowerCase() } : {}),
        ...(role ? { role: role === "admin" ? "admin" : "attendant" } : {}),
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
        ...(queueIds ? { queues: { set: queueIds.map((qid) => ({ id: qid })) } } : {}),
      },
      include: { queues: { select: { id: true, name: true } } },
    });
    res.json(serialize(user));
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Ja existe um usuario com esse e-mail." });
    }
    throw err;
  }
});

// DELETE /api/users/:id
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (id === req.currentUser!.id) {
    return res.status(400).json({ error: "Voce nao pode remover o proprio usuario." });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (target?.role === "admin") {
    const adminCount = await prisma.user.count({
      where: { companyId: req.currentUser!.companyId, role: "admin" },
    });
    if (adminCount <= 1) {
      return res.status(400).json({ error: "Voce nao pode remover o unico administrador." });
    }
  }

  await prisma.user.delete({ where: { id } });
  res.status(204).send();
});

export default router;
