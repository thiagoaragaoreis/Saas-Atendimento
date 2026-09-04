import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: "Clinica Vida Saudavel" },
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
