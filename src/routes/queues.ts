import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAdmin } from "../middleware/currentUser";

const router = Router();

// GET /api/queues — qualquer usuario autenticado pode listar (usado nos
// filtros do painel); a criacao/edicao/remocao e restrita ao admin.
router.get("/", async (req, res) => {
  const queues = await prisma.queue.findMany({
    where: { companyId: req.currentUser!.companyId },
    orderBy: { menuOption: "asc" },
  });
  res.json(queues);
});

// POST /api/queues  { name, menuOption }
router.post("/", requireAdmin, async (req, res) => {
  const { name, menuOption } = req.body as { name?: string; menuOption?: string };

  if (!name?.trim() || !menuOption?.trim()) {
    return res.status(400).json({ error: "Nome e opcao do menu sao obrigatorios." });
  }

  try {
    const queue = await prisma.queue.create({
      data: {
        name: name.trim(),
        menuOption: menuOption.trim(),
        companyId: req.currentUser!.companyId,
      },
    });
    res.status(201).json(queue);
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Ja existe uma fila com essa opcao de menu." });
    }
    throw err;
  }
});

// PUT /api/queues/:id  { name, menuOption }
router.put("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { name, menuOption } = req.body as { name?: string; menuOption?: string };

  try {
    const queue = await prisma.queue.update({
      where: { id },
      data: {
        ...(name?.trim() ? { name: name.trim() } : {}),
        ...(menuOption?.trim() ? { menuOption: menuOption.trim() } : {}),
      },
    });
    res.json(queue);
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Ja existe uma fila com essa opcao de menu." });
    }
    throw err;
  }
});

// DELETE /api/queues/:id
router.delete("/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  await prisma.ticket.updateMany({ where: { queueId: id }, data: { queueId: null } });
  await prisma.queue.delete({ where: { id } });
  res.status(204).send();
});

export default router;
