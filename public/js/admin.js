(function () {
  "use strict";

  const state = { users: [], queues: [], editingUserId: null, editingQueueId: null };

  const errorMsg = document.getElementById("errorMsg");

  function showError(message) {
    errorMsg.textContent = message;
    errorMsg.classList.add("visible");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearError() {
    errorMsg.classList.remove("visible");
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  async function api(url, options) {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
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

  // ---------- Abas ----------
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`panel-${btn.dataset.tab}`).classList.add("active");
      clearError();
    });
  });

  // ================= USUARIOS =================
  const userFormCard = document.getElementById("userFormCard");
  const userFormTitle = document.getElementById("userFormTitle");
  const userIdInput = document.getElementById("userId");
  const userNameInput = document.getElementById("userName");
  const userEmailInput = document.getElementById("userEmail");
  const userPasswordInput = document.getElementById("userPassword");
  const userPasswordHint = document.getElementById("userPasswordHint");
  const userRoleSelect = document.getElementById("userRole");
  const userQueueCheckboxes = document.getElementById("userQueueCheckboxes");

  async function loadUsers() {
    state.users = await api("/api/users");
    renderUsers();
  }

  function renderUsers() {
    document.getElementById("usersTableBody").innerHTML = state.users
      .map((u) => {
        const queueTags = u.queues.length
          ? u.queues.map((q) => `<span class="queue-tag">${escapeHtml(q.name)}</span>`).join("")
          : "<span style=\"color:#9ca3af\">nenhuma</span>";
        return `
        <tr>
          <td>${escapeHtml(u.name)}</td>
          <td>${escapeHtml(u.email)}</td>
          <td><span class="role-badge ${u.role}">${u.role === "admin" ? "Administrador" : "Atendente"}</span></td>
          <td>${queueTags}</td>
          <td class="row-actions">
            <button class="edit" data-id="${u.id}">Editar</button>
            <button class="delete" data-id="${u.id}">Excluir</button>
          </td>
        </tr>`;
      })
      .join("");

    document.querySelectorAll("#usersTableBody .edit").forEach((btn) => {
      btn.addEventListener("click", () => openUserForm(Number(btn.dataset.id)));
    });
    document.querySelectorAll("#usersTableBody .delete").forEach((btn) => {
      btn.addEventListener("click", () => deleteUser(Number(btn.dataset.id)));
    });
  }

  function renderQueueCheckboxes(selectedIds) {
    if (!state.queues.length) {
      userQueueCheckboxes.innerHTML = "<span style=\"color:#9ca3af;font-size:13px\">Cadastre uma fila primeiro.</span>";
      return;
    }
    userQueueCheckboxes.innerHTML = state.queues
      .map(
        (q) => `
        <label>
          <input type="checkbox" value="${q.id}" ${selectedIds.includes(q.id) ? "checked" : ""} />
          ${escapeHtml(q.name)}
        </label>`
      )
      .join("");
  }

  function openUserForm(userId) {
    clearError();
    state.editingUserId = userId || null;
    const user = userId ? state.users.find((u) => u.id === userId) : null;

    userFormTitle.textContent = user ? "Editar usuario" : "Novo usuario";
    userIdInput.value = user ? user.id : "";
    userNameInput.value = user ? user.name : "";
    userEmailInput.value = user ? user.email : "";
    userPasswordInput.value = "";
    userPasswordHint.textContent = user ? "(deixe em branco para manter)" : "";
    userRoleSelect.value = user ? user.role : "attendant";
    renderQueueCheckboxes(user ? user.queues.map((q) => q.id) : []);

    userFormCard.classList.remove("hidden");
    userFormCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  document.getElementById("btnNewUser").addEventListener("click", () => openUserForm(null));
  document.getElementById("btnCancelUser").addEventListener("click", () => userFormCard.classList.add("hidden"));

  document.getElementById("btnSaveUser").addEventListener("click", async () => {
    clearError();
    const name = userNameInput.value.trim();
    const email = userEmailInput.value.trim();
    const password = userPasswordInput.value;
    const role = userRoleSelect.value;
    const queueIds = Array.from(userQueueCheckboxes.querySelectorAll("input:checked")).map((el) => Number(el.value));

    if (!name || !email) return showError("Preencha nome e e-mail.");
    if (!state.editingUserId && !password) return showError("Defina uma senha para o novo usuario.");
    if (password && password.length < 6) return showError("A senha deve ter pelo menos 6 caracteres.");

    try {
      if (state.editingUserId) {
        await api(`/api/users/${state.editingUserId}`, {
          method: "PUT",
          body: JSON.stringify({ name, email, role, queueIds, ...(password ? { password } : {}) }),
        });
      } else {
        await api("/api/users", {
          method: "POST",
          body: JSON.stringify({ name, email, password, role, queueIds }),
        });
      }
      userFormCard.classList.add("hidden");
      await loadUsers();
    } catch (err) {
      showError(err.message);
    }
  });

  async function deleteUser(id) {
    if (!confirm("Remover este usuario?")) return;
    try {
      await api(`/api/users/${id}`, { method: "DELETE" });
      await loadUsers();
    } catch (err) {
      showError(err.message);
    }
  }

  // ================= FILAS =================
  const queueFormCard = document.getElementById("queueFormCard");
  const queueFormTitle = document.getElementById("queueFormTitle");
  const queueIdInput = document.getElementById("queueId");
  const queueNameInput = document.getElementById("queueName");
  const queueMenuOptionInput = document.getElementById("queueMenuOption");

  async function loadQueues() {
    state.queues = await api("/api/queues");
    renderQueues();
  }

  function renderQueues() {
    document.getElementById("queuesTableBody").innerHTML = state.queues
      .map(
        (q) => `
        <tr>
          <td>${escapeHtml(q.name)}</td>
          <td>${escapeHtml(q.menuOption)}</td>
          <td class="row-actions">
            <button class="edit" data-id="${q.id}">Editar</button>
            <button class="delete" data-id="${q.id}">Excluir</button>
          </td>
        </tr>`
      )
      .join("");

    document.querySelectorAll("#queuesTableBody .edit").forEach((btn) => {
      btn.addEventListener("click", () => openQueueForm(Number(btn.dataset.id)));
    });
    document.querySelectorAll("#queuesTableBody .delete").forEach((btn) => {
      btn.addEventListener("click", () => deleteQueue(Number(btn.dataset.id)));
    });
  }

  function openQueueForm(queueId) {
    clearError();
    state.editingQueueId = queueId || null;
    const queue = queueId ? state.queues.find((q) => q.id === queueId) : null;

    queueFormTitle.textContent = queue ? "Editar fila" : "Nova fila";
    queueIdInput.value = queue ? queue.id : "";
    queueNameInput.value = queue ? queue.name : "";
    queueMenuOptionInput.value = queue ? queue.menuOption : "";

    queueFormCard.classList.remove("hidden");
    queueFormCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  document.getElementById("btnNewQueue").addEventListener("click", () => openQueueForm(null));
  document.getElementById("btnCancelQueue").addEventListener("click", () => queueFormCard.classList.add("hidden"));

  document.getElementById("btnSaveQueue").addEventListener("click", async () => {
    clearError();
    const name = queueNameInput.value.trim();
    const menuOption = queueMenuOptionInput.value.trim();

    if (!name || !menuOption) return showError("Preencha nome e opcao do menu.");

    try {
      if (state.editingQueueId) {
        await api(`/api/queues/${state.editingQueueId}`, {
          method: "PUT",
          body: JSON.stringify({ name, menuOption }),
        });
      } else {
        await api("/api/queues", { method: "POST", body: JSON.stringify({ name, menuOption }) });
      }
      queueFormCard.classList.add("hidden");
      await loadQueues();
      await loadUsers();
    } catch (err) {
      showError(err.message);
    }
  });

  async function deleteQueue(id) {
    if (!confirm("Remover esta fila? Tickets nela ficarao sem fila.")) return;
    try {
      await api(`/api/queues/${id}`, { method: "DELETE" });
      await loadQueues();
      await loadUsers();
    } catch (err) {
      showError(err.message);
    }
  }

  // ---------- Inicializacao ----------
  (async () => {
    try {
      await loadQueues();
      await loadUsers();
    } catch (err) {
      showError(err.message);
    }
  })();
})();
