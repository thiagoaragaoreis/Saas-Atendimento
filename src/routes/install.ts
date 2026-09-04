import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { isInstalled, markInstalled } from "../lib/settings";

const router = Router();

// GET /api/install/status
router.get("/status", async (_req, res) => {
  const installed = await isInstalled();
  const company = await prisma.company.findFirst();
  const adminCount = await prisma.user.count();

  res.json({
    installed,
    hasCompany: Boolean(company),
    hasAdmin: adminCount > 0,
    companyName: company?.name || null,
  });
});

// POST /api/install/company  { name }
router.post("/company", async (req, res) => {
  if (await isInstalled()) {
    return res.status(409).json({ error: "O sistema ja foi instalado." });
  }

  const { name } = req.body as { name?: string };
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Informe o nome da clinica ou empresa." });
  }

  const existing = await prisma.company.findFirst();
  const company = existing
    ? await prisma.company.update({ where: { id: existing.id }, data: { name: name.trim() } })
    : await prisma.company.create({ data: { name: name.trim() } });

  res.status(201).json(company);
});

// POST /api/install/admin  { name, email, password }
router.post("/admin", async (req, res) => {
  if (await isInstalled()) {
    return res.status(409).json({ error: "O sistema ja foi instalado." });
  }

  const { name, email, password } = req.body as {
    name?: string;
    email?: string;
    password?: string;
  };

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Nome, e-mail e senha sao obrigatorios." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres." });
  }

  const company = await prisma.company.findFirst();
  if (!company) {
    return res.status(400).json({ error: "Cadastre os dados da clinica antes de criar o usuario." });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const existingAdmin = await prisma.user.findFirst();
    const user = existingAdmin
      ? await prisma.user.update({
          where: { id: existingAdmin.id },
          data: { name: name.trim(), email: email.trim().toLowerCase(), passwordHash, role: "admin" },
        })
      : await prisma.user.create({
          data: {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            passwordHash,
            companyId: company.id,
            role: "admin",
          },
        });

    res.status(201).json({ id: user.id, name: user.name, email: user.email });
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Ja existe um usuario com esse e-mail." });
    }
    throw err;
  }
});

// POST /api/install/finish
router.post("/finish", async (req, res) => {
  if (await isInstalled()) {
    return res.status(409).json({ error: "O sistema ja foi instalado." });
  }

  const company = await prisma.company.findFirst();
  const admin = await prisma.user.findFirst();

  if (!company || !admin) {
    return res.status(400).json({ error: "Conclua os passos anteriores antes de finalizar." });
  }

  await markInstalled();

  req.session.userId = admin.id;
  req.session.companyId = admin.companyId;

  res.json({ ok: true });
});

export default router;
