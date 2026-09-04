import cron from "node-cron";
import { prisma } from "../lib/prisma";
import { sendWhatsappMessage } from "../wbot";

function startOfTomorrow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfTomorrow(): Date {
  const d = startOfTomorrow();
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startReminderJob(): void {
  // roda a cada 5 minutos
  cron.schedule("*/5 * * * *", async () => {
    try {
      await sendTomorrowReminders();
    } catch (err) {
      console.error("[ReminderJob] Erro ao processar lembretes:", err);
    }
  });

  console.log("[ReminderJob] Agendado para rodar a cada 5 minutos");
}

async function sendTomorrowReminders(): Promise<void> {
  const appointments = await prisma.appointment.findMany({
    where: {
      status: "scheduled",
      reminderSentAt: null,
      date: { gte: startOfTomorrow(), lte: endOfTomorrow() },
    },
    include: { contact: true },
  });

  for (const appointment of appointments) {
    const dataFormatada = appointment.date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    const texto =
      `Ola, ${appointment.contact.name}! Voce tem uma consulta agendada para amanha, ` +
      `${dataFormatada}. Digite *1* para confirmar sua presenca.`;

    try {
      await sendWhatsappMessage(appointment.contact.number, texto);
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { reminderSentAt: new Date() },
      });
      console.log(`[ReminderJob] Lembrete enviado para ${appointment.contact.name}`);
    } catch (err) {
      console.error(`[ReminderJob] Falha ao enviar lembrete para ${appointment.contact.name}:`, err);
    }
  }
}
