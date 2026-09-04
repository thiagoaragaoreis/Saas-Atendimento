(function () {
  "use strict";

  const form = document.getElementById("loginForm");
  const errorMsg = document.getElementById("errorMsg");
  const btnLogin = document.getElementById("btnLogin");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorMsg.classList.remove("visible");
    btnLogin.disabled = true;
    btnLogin.textContent = "Entrando...";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(body.error || "Nao foi possivel entrar.");

      window.location.href = "/";
    } catch (err) {
      errorMsg.textContent = err.message;
      errorMsg.classList.add("visible");
      btnLogin.disabled = false;
      btnLogin.textContent = "Entrar";
    }
  });
})();
