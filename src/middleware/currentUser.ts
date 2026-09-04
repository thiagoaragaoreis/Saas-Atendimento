import { RequestHandler } from "express";
import { prisma } from "../lib/prisma";

// Carrega o usuario logado (com as filas que ele pode acessar) e anexa em
// req.currentUser. Deve rodar depois do gate, que ja garante sessao valida
// nas rotas protegidas.
export const attachCurrentUser: RequestHandler = async (req, res, next) => {
  if (!req.session.userId) return next();

  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    include: { queues: { select: { id: true } } },
  });

  if (!user) {
    req.session.destroy(() => undefined);
    return res.status(401).json({ error: "Nao autenticado" });
  }

  req.currentUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    queueIds: user.queues.map((q) => q.id),
  };

  next();
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (req.currentUser?.role !== "admin") {
    return res.status(403).json({ error: "Apenas administradores podem fazer isso." });
  }
  next();
};
