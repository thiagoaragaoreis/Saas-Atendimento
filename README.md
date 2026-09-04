# SaaS de Atendimento

Sistema de atendimento omnichannel via WhatsApp (Baileys) com painel de recepcao
(TV) e agendamento de consultas, focado em clinicas medicas e comercios locais.

## Stack

- Node.js + TypeScript + Express
- `@whiskeysockets/baileys` para conexao nativa com o WhatsApp (QR Code)
- Socket.io para tempo real
- Prisma ORM (SQLite em desenvolvimento, pronto para PostgreSQL)
- `node-cron` para lembretes automaticos de consulta

## Como rodar

```bash
npm install
npx prisma migrate dev
npm run seed      # dados de demonstracao (opcional)
npm run dev
```

O servidor sobe em `http://localhost:3000`.

- `/` — Painel de Atendimento (Mini-CRM): lista de tickets, chat e agendamentos
- `/tv` — Painel de recepcao (fila + midia institucional)

Na primeira conexao, escaneie o QR Code exibido no painel de atendimento para
autenticar o WhatsApp.

## Estrutura

```
src/
  server.ts          Bootstrap do Express + Socket.io
  wbot.ts             Conexao com o WhatsApp via Baileys
  jobs/ReminderJob.ts Cron de lembretes de consulta (D-1)
  routes/             Rotas REST (tickets, mensagens, agendamentos, TV)
  socket/io.ts         Instancia compartilhada do Socket.io
prisma/
  schema.prisma       Modelo multilocatario (Company, Contact, Ticket, Message, Appointment)
  seed.ts             Dados de demonstracao
public/
  painel.html/css/js  Painel de atendimento (Mini-CRM)
  tv.html             Painel de recepcao
```

## Migrando para PostgreSQL

Troque `provider = "sqlite"` por `provider = "postgresql"` em
`prisma/schema.prisma` e ajuste `DATABASE_URL` no `.env`.
