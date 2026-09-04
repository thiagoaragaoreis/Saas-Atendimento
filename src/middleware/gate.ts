import { RequestHandler } from "express";
import { isInstalled } from "../lib/settings";

const PUBLIC_PREFIXES = ["/css/", "/js/", "/socket.io", "/api/install", "/api/auth"];
// /install e /login passam direto para os handlers dedicados em server.ts,
// que decidem a pagina certa conforme o estado do sistema (evitando loop de
// redirecionamento). As variantes .html NAO estao na lista: acesso direto a
// elas passa pelo gate padrao, que ja bloqueia /install.html apos a
// instalacao. /tv e publico de proposito (kiosk de recepcao sem login).
const PUBLIC_EXACT = ["/install", "/login", "/tv", "/tv.html"];

function isPublicPath(path: string): boolean {
  return PUBLIC_EXACT.includes(path) || PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix));
}

// Garante que ninguem acesse o painel sem instalar o sistema primeiro,
// e que ninguem acesse dados sem estar autenticado depois de instalado.
export const gate: RequestHandler = async (req, res, next) => {
  if (isPublicPath(req.path)) return next();

  const isApiRequest = req.path.startsWith("/api/");
  const installed = await isInstalled();

  if (!installed) {
    if (!isApiRequest && req.method === "GET") return res.redirect("/install");
    return res.status(403).json({ error: "O sistema ainda nao foi instalado. Acesse /install." });
  }

  if (req.session.userId) return next();

  if (!isApiRequest && req.method === "GET") return res.redirect("/login");
  return res.status(401).json({ error: "Nao autenticado" });
};
