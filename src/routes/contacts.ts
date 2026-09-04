import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/contacts?search=texto
router.get("/", async (req, res) => {
  const { search } = req.query as { search?: string };

  const contacts = await prisma.contact.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search } },
            { number: { contains: search } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
  });

  res.json(contacts);
});

export default router;
