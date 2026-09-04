(function () {
  "use strict";

  const socket = io();
  let currentStep = 1;
  const totalSteps = 5;

  const data = {
    companyName: "",
    adminName: "",
    adminEmail: "",
  };

  const errorMsg = document.getElementById("errorMsg");
  const stepsIndicator = document.getElementById("stepsIndicator");

  function showError(message) {
    errorMsg.textContent = message;
    errorMsg.classList.add("visible");
  }

  function clearError() {
    errorMsg.classList.remove("visible");
  }

  function goToStep(step) {
    currentStep = step;
    clearError();

    document.querySelectorAll(".step").forEach((el) => {
      el.classList.toggle("active", Number(el.dataset.step) === step);
    });

    stepsIndicator.querySelectorAll(".dot").forEach((el) => {
      const n = Number(el.dataset.step);
      el.classList.toggle("active", n === step);
      el.classList.toggle("done", n < step);
    });

    if (step === 5) renderSummary();
  }

  function renderSummary() {
    document.getElementById("summaryBox").innerHTML = `
      <div><strong>Clinica:</strong> ${escapeHtml(data.companyName)}</div>
      <div><strong>Administrador:</strong> ${escapeHtml(data.adminName)}</div>
      <div><strong>E-mail de login:</strong> ${escapeHtml(data.adminEmail)}</div>
    `;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  async function api(url, options) {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Erro na requisicao");
    return body;
  }

  // ---------- Navegacao ----------
  document.getElementById("btnStart").addEventListener("click", () => goToStep(2));

  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => goToStep(Math.max(1, currentStep - 1)));
  });

  // ---------- Passo 2: clinica ----------
  document.getElementById("btnCompanyNext").addEventListener("click", async () => {
    const name = document.getElementById("companyName").value.trim();
    if (!name) return showError("Informe o nome da clinica ou empresa.");

    try {
      await api("/api/install/company", { method: "POST", body: JSON.stringify({ name }) });
      data.companyName = name;
      goToStep(3);
    } catch (err) {
      showError(err.message);
    }
  });

  // ---------- Passo 3: administrador ----------
  document.getElementById("btnAdminNext").addEventListener("click", async () => {
    const name = document.getElementById("adminName").value.trim();
    const email = document.getElementById("adminEmail").value.trim();
    const password = document.getElementById("adminPassword").value;
    const confirm = document.getElementById("adminPasswordConfirm").value;

    if (!name || !email || !password) return showError("Preencha todos os campos.");
    if (password.length < 6) return showError("A senha deve ter pelo menos 6 caracteres.");
    if (password !== confirm) return showError("As senhas nao coincidem.");

    try {
      await api("/api/install/admin", { method: "POST", body: JSON.stringify({ name, email, password }) });
      data.adminName = name;
      data.adminEmail = email;
      goToStep(4);
    } catch (err) {
      showError(err.message);
    }
  });

  // ---------- Passo 4: WhatsApp ----------
  document.getElementById("btnWhatsappNext").addEventListener("click", () => goToStep(5));

  socket.on("whatsapp:qr", (payload) => {
    const qrImage = document.getElementById("qrImage");
    const qrPlaceholder = document.getElementById("qrPlaceholder");
    qrImage.src = payload.qr;
    qrImage.style.display = "block";
    qrPlaceholder.style.display = "none";
  });

  socket.on("whatsapp:status", (payload) => {
    const qrStatus = document.getElementById("qrStatus");
    if (payload.status === "connected") {
      qrStatus.textContent = "WhatsApp conectado com sucesso!";
      qrStatus.classList.add("connected");
    } else {
      qrStatus.textContent = "Aguardando conexao...";
      qrStatus.classList.remove("connected");
    }
  });

  // ---------- Passo 5: finalizar ----------
  document.getElementById("btnFinish").addEventListener("click", async () => {
    try {
      await api("/api/install/finish", { method: "POST" });
      window.location.href = "/";
    } catch (err) {
      showError(err.message);
    }
  });

  // ---------- Inicializacao ----------
  (async () => {
    try {
      const status = await api("/api/install/status");
      if (status.installed) {
        window.location.href = "/login";
        return;
      }
    } catch (e) {
      // segue no passo 1 mesmo se a checagem falhar
    }
    goToStep(1);
  })();
})();
