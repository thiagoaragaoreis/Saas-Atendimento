import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

const router = Router();

// POST /api/auth/login  { email, password }
router.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: "Informe e-mail e senha." });
  }

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) {
    return res.status(401).json({ error: "E-mail ou senha invalidos." });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "E-mail ou senha invalidos." });
  }

  req.session.userId = user.id;
  req.session.companyId = user.companyId;

  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

// GET /api/auth/me
router.get("/me", (req, res) => {
  if (!req.currentUser) {
    return res.status(401).json({ error: "Nao autenticado" });
  }
  res.json(req.currentUser);
});

export default router;
