(function () {
  "use strict";

  const socket = io();

  const state = {
    statusFilter: "open",
    search: "",
    queueFilter: "",
    tickets: [],
    queues: [],
    currentUser: null,
    currentTicket: null,
    searchTimer: null,
  };

  // ---------- Elementos ----------
  const ticketListEl = document.getElementById("ticketList");
  const searchInput = document.getElementById("searchInput");
  const tabs = document.querySelectorAll(".tab");
  const connStatus = document.getElementById("connStatus");

  const queueFilterSelect = document.getElementById("queueFilter");
  const adminLink = document.getElementById("adminLink");

  const chatEmpty = document.getElementById("chatEmpty");
  const chatContent = document.getElementById("chatContent");
  const chatAvatar = document.getElementById("chatAvatar");
  const chatName = document.getElementById("chatName");
  const chatNumber = document.getElementById("chatNumber");
  const chatQueueBadge = document.getElementById("chatQueueBadge");
  const messagesList = document.getElementById("messagesList");
  const sendForm = document.getElementById("sendForm");
  const sendInput = document.getElementById("sendInput");
  const btnClose = document.getElementById("btnClose");
  const btnPending = document.getElementById("btnPending");

  const scheduleEmpty = document.getElementById("scheduleEmpty");
  const scheduleContent = document.getElementById("scheduleContent");
  const appointmentList = document.getElementById("appointmentList");
  const appointmentForm = document.getElementById("appointmentForm");
  const appointmentDate = document.getElementById("appointmentDate");
  const appointmentNotes = document.getElementById("appointmentNotes");

  const qrOverlay = document.getElementById("qrOverlay");
  const qrImage = document.getElementById("qrImage");
  const qrStatus = document.getElementById("qrStatus");

  // ---------- Helpers ----------
  function initials(name) {
    if (!name) return "?";
    return name.trim().charAt(0).toUpperCase();
  }

  function formatTime(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function formatDateTime(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function statusLabel(status) {
    return { open: "Aberto", pending: "Pendente", closed: "Fechado" }[status] || status;
  }

  function appointmentStatusLabel(status) {
    return (
      { scheduled: "Agendado", confirmed: "Confirmado", cancelled: "Cancelado", done: "Concluido" }[status] ||
      status
    );
  }

  async function api(url, options) {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (res.status === 401) {
      window.location.href = "/login";
      throw new Error("Sessao expirada");
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Erro na requisicao");
    }
    if (res.status === 204) return null;
    return res.json();
  }

  // ---------- Usuario logado ----------
  const userNameEl = document.getElementById("userName");
  const btnLogout = document.getElementById("btnLogout");

  async function loadCurrentUser() {
    try {
      const user = await api("/api/auth/me");
      state.currentUser = user;
      userNameEl.textContent = user.name;
      if (user.role === "admin") adminLink.classList.remove("hidden");
    } catch (e) {
      // api() ja redireciona para /login em caso de 401
    }
  }

  btnLogout.addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  });

  // ---------- Filas ----------
  async function loadQueues() {
    try {
      state.queues = await api("/api/queues");
      queueFilterSelect.innerHTML =
        `<option value="">Todas as filas</option>` +
        state.queues.map((q) => `<option value="${q.id}">${escapeHtml(q.name)}</option>`).join("");
    } catch (e) {
      // silencioso: filtro de fila e opcional
    }
  }

  queueFilterSelect.addEventListener("change", () => {
    state.queueFilter = queueFilterSelect.value;
    loadTickets();
  });

  // ---------- Lista de tickets ----------
  async function loadTickets() {
    const params = new URLSearchParams();
    if (state.statusFilter) params.set("status", state.statusFilter);
    if (state.search) params.set("search", state.search);
    if (state.queueFilter) params.set("queueId", state.queueFilter);

    const tickets = await api(`/api/tickets?${params.toString()}`);
    state.tickets = tickets;
    renderTicketList();
  }

  function renderTicketList() {
    ticketListEl.innerHTML = state.tickets
      .map((t) => {
        const active = state.currentTicket && state.currentTicket.id === t.id ? "active" : "";
        const unread = t.unreadMessages > 0 ? `<span class="unread-badge">${t.unreadMessages}</span>` : "";
        return `
        <li class="ticket-item ${active}" data-id="${t.id}">
          <div class="avatar">${initials(t.contact.name)}</div>
          <div class="meta">
            <div class="row-top">
              <span class="name">${escapeHtml(t.contact.name)}</span>
              <span class="time">${t.updatedAt ? formatTime(t.updatedAt) : ""}</span>
            </div>
            <div class="row-top">
              <span class="preview">${escapeHtml(t.lastMessage || "Sem mensagens")}</span>
              ${unread}
            </div>
            <span class="status-chip status-${t.status}">${statusLabel(t.status)}</span>
            ${t.queue ? `<span class="queue-chip">${escapeHtml(t.queue.name)}</span>` : ""}
          </div>
        </li>`;
      })
      .join("");

    ticketListEl.querySelectorAll(".ticket-item").forEach((el) => {
      el.addEventListener("click", () => selectTicket(Number(el.dataset.id)));
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  // ---------- Selecionar ticket ----------
  async function selectTicket(ticketId) {
    const ticket = state.tickets.find((t) => t.id === ticketId);
    if (!ticket) return;

    state.currentTicket = ticket;
    renderTicketList();

    chatEmpty.classList.add("hidden");
    chatContent.classList.remove("hidden");
    scheduleEmpty.classList.add("hidden");
    scheduleContent.classList.remove("hidden");

    chatAvatar.textContent = initials(ticket.contact.name);
    chatName.textContent = ticket.contact.name;
    chatNumber.textContent = ticket.contact.number;
    if (ticket.queue) {
      chatQueueBadge.textContent = ticket.queue.name;
      chatQueueBadge.classList.remove("hidden");
    } else {
      chatQueueBadge.classList.add("hidden");
    }

    const messages = await api(`/api/tickets/${ticketId}/messages`);
    renderMessages(messages);

    if (ticket.unreadMessages > 0) {
      await api(`/api/tickets/${ticketId}/read`, { method: "POST" });
      ticket.unreadMessages = 0;
      renderTicketList();
    }

    await loadAppointments(ticket.contact.id);
  }

  function renderMessages(messages) {
    messagesList.innerHTML = messages
      .map(
        (m) => `
        <div class="bubble ${m.fromMe ? "out" : "in"}">
          ${escapeHtml(m.body)}
          <span class="time">${formatTime(m.createdAt)}</span>
        </div>`
      )
      .join("");
    messagesList.scrollTop = messagesList.scrollHeight;
  }

  // ---------- Envio de mensagens ----------
  sendForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = sendInput.value.trim();
    if (!body || !state.currentTicket) return;

    sendInput.value = "";
    try {
      await api("/api/enviar", {
        method: "POST",
        body: JSON.stringify({ ticketId: state.currentTicket.id, body }),
      });
    } catch (err) {
      alert("Nao foi possivel enviar a mensagem: " + err.message);
    }
  });

  // ---------- Acoes do ticket ----------
  btnClose.addEventListener("click", async () => {
    if (!state.currentTicket) return;
    await api(`/api/tickets/${state.currentTicket.id}`, {
      method: "PUT",
      body: JSON.stringify({ status: "closed" }),
    });
  });

  btnPending.addEventListener("click", async () => {
    if (!state.currentTicket) return;
    await api(`/api/tickets/${state.currentTicket.id}`, {
      method: "PUT",
      body: JSON.stringify({ status: "pending" }),
    });
  });

  // ---------- Agendamentos ----------
  async function loadAppointments(contactId) {
    const appointments = await api(`/api/appointments?contactId=${contactId}`);
    renderAppointments(appointments);
  }

  function renderAppointments(appointments) {
    if (!appointments.length) {
      appointmentList.innerHTML = `<li class="appointment-item">Nenhum agendamento ainda.</li>`;
      return;
    }

    appointmentList.innerHTML = appointments
      .map(
        (a) => `
        <li class="appointment-item" data-id="${a.id}">
          <div class="date">${formatDateTime(a.date)}</div>
          ${a.notes ? `<div class="notes">${escapeHtml(a.notes)}</div>` : ""}
          <div class="row-bottom">
            <span class="status-chip status-${a.status === "confirmed" ? "open" : a.status === "cancelled" ? "closed" : "pending"}">
              ${appointmentStatusLabel(a.status)}
            </span>
            ${
              a.status !== "cancelled" && a.status !== "done"
                ? `<button class="btn btn-secondary btn-cancel-appt" data-id="${a.id}">Cancelar</button>`
                : ""
            }
          </div>
        </li>`
      )
      .join("");

    appointmentList.querySelectorAll(".btn-cancel-appt").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await api(`/api/appointments/${btn.dataset.id}`, {
          method: "PUT",
          body: JSON.stringify({ status: "cancelled" }),
        });
        if (state.currentTicket) await loadAppointments(state.currentTicket.contact.id);
      });
    });
  }

  appointmentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!state.currentTicket) return;

    try {
      await api("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          contactId: state.currentTicket.contact.id,
          companyId: state.currentTicket.companyId,
          date: appointmentDate.value,
          notes: appointmentNotes.value.trim() || undefined,
        }),
      });
      appointmentForm.reset();
      await loadAppointments(state.currentTicket.contact.id);
    } catch (err) {
      alert("Nao foi possivel criar o agendamento: " + err.message);
    }
  });

  // ---------- Busca e filtros ----------
  searchInput.addEventListener("input", () => {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => {
      state.search = searchInput.value.trim();
      loadTickets();
    }, 300);
  });

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      state.statusFilter = tab.dataset.status;
      loadTickets();
    });
  });

  // ---------- Socket.io ----------
  socket.on("whatsapp:qr", (data) => {
    qrImage.src = data.qr;
    qrStatus.textContent = "Aguardando leitura...";
    qrOverlay.classList.remove("hidden");
  });

  socket.on("whatsapp:status", (data) => {
    if (data.status === "connected") {
      connStatus.textContent = "online";
      connStatus.className = "conn-badge conn-online";
      qrOverlay.classList.add("hidden");
    } else {
      connStatus.textContent = "offline";
      connStatus.className = "conn-badge conn-offline";
    }
  });

  // Os eventos de socket sao globais (nao filtrados por fila no servidor);
  // aqui garantimos que o atendente so veja em tempo real os tickets das
  // filas que ele tem permissao (admin ve tudo).
  function canSeeTicket(ticket) {
    if (!state.currentUser) return false;
    if (state.currentUser.role === "admin") return true;
    return ticket.queueId != null && state.currentUser.queueIds.includes(ticket.queueId);
  }

  socket.on("ticket:message", (data) => {
    if (!canSeeTicket(data.ticket)) return;

    const idx = state.tickets.findIndex((t) => t.id === data.ticket.id);
    if (idx >= 0) {
      state.tickets[idx] = data.ticket;
    } else {
      state.tickets.unshift(data.ticket);
    }
    sortTickets();
    renderTicketList();

    if (state.currentTicket && state.currentTicket.id === data.ticket.id) {
      appendMessage(data.message);
    }
  });

  socket.on("ticket:update", (ticket) => {
    if (!canSeeTicket(ticket)) {
      state.tickets = state.tickets.filter((t) => t.id !== ticket.id);
      renderTicketList();
      return;
    }

    const idx = state.tickets.findIndex((t) => t.id === ticket.id);
    if (idx >= 0) {
      state.tickets[idx] = ticket;
      sortTickets();
    }
    renderTicketList();
  });

  socket.on("appointment:update", (appointment) => {
    if (state.currentTicket && state.currentTicket.contact.id === appointment.contactId) {
      loadAppointments(appointment.contactId);
    }
  });

  function sortTickets() {
    state.tickets.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  function appendMessage(message) {
    const bubble = document.createElement("div");
    bubble.className = `bubble ${message.fromMe ? "out" : "in"}`;
    bubble.innerHTML = `${escapeHtml(message.body)}<span class="time">${formatTime(message.createdAt)}</span>`;
    messagesList.appendChild(bubble);
    messagesList.scrollTop = messagesList.scrollHeight;

    api(`/api/tickets/${state.currentTicket.id}/read`, { method: "POST" }).catch(() => {});
  }

  // ---------- Inicializacao ----------
  loadCurrentUser();
  loadQueues();
  loadTickets();
  setInterval(loadTickets, 15000);
})();
