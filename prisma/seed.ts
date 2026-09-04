import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_ADMIN_EMAIL = "admin@clinica.com";
const DEMO_ADMIN_PASSWORD = "admin123";

async function main() {
  const company = await prisma.company.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: "Clinica Vida Saudavel" },
  });

  const passwordHash = await bcrypt.hash(DEMO_ADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: DEMO_ADMIN_EMAIL },
    update: {},
    create: {
      name: "Administrador Demo",
      email: DEMO_ADMIN_EMAIL,
      passwordHash,
      companyId: company.id,
      role: "admin",
    },
  });

  await Promise.all(
    [
      { name: "Recepcao", menuOption: "1" },
      { name: "Financeiro", menuOption: "2" },
    ].map((q) =>
      prisma.queue.upsert({
        where: { companyId_menuOption: { companyId: company.id, menuOption: q.menuOption } },
        update: {},
        create: { ...q, companyId: company.id },
      })
    )
  );

  await prisma.setting.upsert({
    where: { id: 1 },
    update: { installed: true },
    create: { id: 1, installed: true },
  });

  const contacts = await Promise.all(
    [
      { name: "Maria Silva", number: "5511999990001" },
      { name: "Joao Pereira", number: "5511999990002" },
      { name: "Ana Souza", number: "5511999990003" },
    ].map((c) =>
      prisma.contact.upsert({
        where: { number_companyId: { number: c.number, companyId: company.id } },
        update: {},
        create: { ...c, companyId: company.id },
      })
    )
  );

  for (const [i, contact] of contacts.entries()) {
    const existing = await prisma.ticket.findFirst({ where: { contactId: contact.id } });
    if (existing) continue;

    const ticket = await prisma.ticket.create({
      data: {
        contactId: contact.id,
        companyId: company.id,
        status: i === 0 ? "open" : i === 1 ? "pending" : "closed",
        lastMessage: "Ola, gostaria de agendar uma consulta.",
      },
    });

    await prisma.message.create({
      data: { ticketId: ticket.id, body: "Ola, gostaria de agendar uma consulta.", fromMe: false },
    });
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 30, 0, 0);

  const appointmentExists = await prisma.appointment.findFirst({ where: { contactId: contacts[0].id } });
  if (!appointmentExists) {
    await prisma.appointment.create({
      data: {
        contactId: contacts[0].id,
        companyId: company.id,
        date: tomorrow,
        status: "scheduled",
        notes: "Consulta de rotina",
      },
    });
  }

  console.log("Seed concluido.");
  console.log(`Login de demonstracao: ${DEMO_ADMIN_EMAIL} / ${DEMO_ADMIN_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
