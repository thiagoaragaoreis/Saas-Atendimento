import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import http from "http";
import { Server } from "socket.io";

import { setIo } from "./socket/io";
import { startWbot } from "./wbot";
import { startReminderJob } from "./jobs/ReminderJob";

import ticketsRouter from "./routes/tickets";
import messagesRouter from "./routes/messages";
import appointmentsRouter from "./routes/appointments";
import contactsRouter from "./routes/contacts";
import tvRouter from "./routes/tv";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
setIo(io);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "painel.html"));
});

app.get("/tv", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "tv.html"));
});

app.use("/api/tickets", ticketsRouter);
app.use("/api", messagesRouter);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/contacts", contactsRouter);
app.use("/api/tv", tvRouter);

io.on("connection", (socket) => {
  console.log("[socket] Cliente conectado:", socket.id);
  socket.on("disconnect", () => console.log("[socket] Cliente desconectado:", socket.id));
});

const PORT = Number(process.env.PORT) || 3000;

server.listen(PORT, () => {
  console.log(`[server] Rodando em http://localhost:${PORT}`);
  startWbot().catch((err) => console.error("[wbot] Erro ao iniciar:", err));
  startReminderJob();
});
