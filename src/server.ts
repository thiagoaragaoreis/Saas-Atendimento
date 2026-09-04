import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import http from "http";
import session from "express-session";
import { Server } from "socket.io";

import { setIo } from "./socket/io";
import { startWbot } from "./wbot";
import { startReminderJob } from "./jobs/ReminderJob";
import { gate } from "./middleware/gate";
import { attachCurrentUser } from "./middleware/currentUser";
import { isInstalled } from "./lib/settings";

import ticketsRouter from "./routes/tickets";
import messagesRouter from "./routes/messages";
import appointmentsRouter from "./routes/appointments";
import contactsRouter from "./routes/contacts";
import tvRouter from "./routes/tv";
import installRouter from "./routes/install";
import authRouter from "./routes/auth";
import usersRouter from "./routes/users";
import queuesRouter from "./routes/queues";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
setIo(io);

const PUBLIC_DIR = path.join(__dirname, "..", "public");

app.use(cors());
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "troque-esta-chave-em-producao",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 },
  })
);

app.use(gate);
app.use(attachCurrentUser);

app.get("/install", async (_req, res) => {
  if (await isInstalled()) return res.redirect("/login");
  res.sendFile(path.join(PUBLIC_DIR, "install.html"));
});

app.get("/login", async (_req, res) => {
  if (!(await isInstalled())) return res.redirect("/install");
  res.sendFile(path.join(PUBLIC_DIR, "login.html"));
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "painel.html"));
});

app.get("/tv", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "tv.html"));
});

app.get("/admin", (req, res) => {
  if (req.currentUser?.role !== "admin") return res.redirect("/");
  res.sendFile(path.join(PUBLIC_DIR, "admin.html"));
});

app.use(express.static(PUBLIC_DIR));

app.use("/api/install", installRouter);
app.use("/api/auth", authRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api", messagesRouter);
app.use("/api/appointments", appointmentsRouter);
app.use("/api/contacts", contactsRouter);
app.use("/api/tv", tvRouter);
app.use("/api/users", usersRouter);
app.use("/api/queues", queuesRouter);

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
