# SaaS de Atendimento

Sistema de atendimento omnichannel via WhatsApp (Baileys) com painel de recepcao
(TV) e agendamento de consultas, focado em clinicas medicas e comercios locais.

## Stack

- Node.js + TypeScript + Express
- `@whiskeysockets/baileys` para conexao nativa com o WhatsApp (QR Code)
- Socket.io para tempo real
- Prisma ORM (SQLite em desenvolvimento, pronto para PostgreSQL)
- `node-cron` para lembretes automaticos de consulta
- `express-session` + `bcryptjs` para login do painel

## Instalacao passo a passo

### 1. Pre-requisitos

- Node.js 18 ou superior instalado (`node -v` para conferir)
- Um numero de WhatsApp disponivel para escanear o QR Code

### 2. Baixe/clone o projeto e instale as dependencias

```bash
git clone <url-do-repositorio>
cd Saas-Atendimento
npm install
```

### 3. Configure as variaveis de ambiente

Copie o arquivo de exemplo (ou crie um `.env` na raiz do projeto):

```bash
DATABASE_URL="file:./dev.db"
PORT=3000
SESSION_SECRET="troque-por-uma-string-aleatoria-bem-grande"
```

> `SESSION_SECRET` protege os cookies de login — use um valor unico e
> secreto em producao.

### 4. Prepare o banco de dados

```bash
npx prisma migrate deploy   # aplica as migracoes existentes
```

(Em ambiente de desenvolvimento, `npx prisma migrate dev` tambem funciona.)

### 5. Compile e suba o servidor

```bash
npm run build
npm start
```

Ou, para desenvolvimento com recarregamento automatico:

```bash
npm run dev
```

O servidor sobe em `http://localhost:3000`.

### 6. Finalize pelo assistente de instalacao

Acesse **`http://localhost:3000/install`** no navegador. O assistente vai
guiar voce por 5 passos:

1. **Boas-vindas**
2. **Dados da clinica/empresa** — nome exibido no sistema
3. **Usuario administrador** — nome, e-mail e senha usados para logar no painel
4. **Conectar WhatsApp** — escaneie o QR Code exibido na tela com o app do
   WhatsApp (Aparelhos conectados). Pode ser pulado e feito depois.
5. **Concluir** — revisa os dados e finaliza a instalacao

Ao concluir, voce ja entra automaticamente no painel. Da proxima vez, o
acesso e feito por `http://localhost:3000/login` com o e-mail/senha
cadastrados.

> Enquanto o sistema nao for instalado, qualquer acesso ao painel (`/`)
> redireciona automaticamente para `/install`. Depois de instalado, `/install`
> fica bloqueado e o acesso ao painel passa a exigir login.

### Dados de demonstracao (opcional)

Para testar rapidamente com dados ficticios (empresa, contatos, tickets e um
agendamento de exemplo) sem passar pelo assistente:

```bash
npm run seed
```

Isso ja marca o sistema como instalado e cria o login:

```
E-mail: admin@clinica.com
Senha:  admin123
```

## Paginas

- `/install` — assistente de instalacao (bloqueado apos concluido)
- `/login` — login do painel
- `/` — Painel de Atendimento (Mini-CRM): lista de tickets, chat e agendamentos
- `/tv` — Painel de recepcao (fila + midia institucional), acesso publico
  para exibir em TV na sala de espera

## Rodando em producao (exemplo com PM2)

```bash
npm install -g pm2
npm run build
pm2 start dist/server.js --name saas-atendimento
pm2 save
```

Coloque um proxy reverso (Nginx/Caddy) na frente com HTTPS e ajuste o
cookie de sessao para `secure: true` em `src/server.ts` quando estiver
servindo por HTTPS.

## Estrutura

```
src/
  server.ts            Bootstrap do Express + Socket.io + sessao
  wbot.ts               Conexao com o WhatsApp via Baileys
  jobs/ReminderJob.ts   Cron de lembretes de consulta (D-1)
  middleware/gate.ts    Redireciona para /install ou /login conforme o estado
  routes/                Rotas REST (tickets, mensagens, agendamentos, TV,
                          instalacao, autenticacao)
  socket/io.ts           Instancia compartilhada do Socket.io
prisma/
  schema.prisma         Modelo multilocatario (Company, Contact, Ticket,
                         Message, Appointment, User, Setting)
  seed.ts               Dados de demonstracao + usuario admin de teste
public/
  painel.html/css/js    Painel de atendimento (Mini-CRM)
  tv.html                Painel de recepcao
  install.html/js        Assistente de instalacao
  login.html/js          Tela de login
```

## Migrando para PostgreSQL

Troque `provider = "sqlite"` por `provider = "postgresql"` em
`prisma/schema.prisma` e ajuste `DATABASE_URL` no `.env`.
