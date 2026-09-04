import { Router } from "express";
import { getIo } from "../socket/io";

const router = Router();

// POST /api/tv/chamar  { senha, guiche }
router.post("/chamar", (req, res) => {
  const { senha, guiche } = req.body as { senha: string; guiche?: string };

  if (!senha) {
    return res.status(400).json({ error: "senha e obrigatoria" });
  }

  getIo().emit("tv:chamada", { senha, guiche: guiche || "1", chamadoEm: new Date() });
  res.json({ ok: true });
});

export default router;
