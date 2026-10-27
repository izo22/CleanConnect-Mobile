// Sign-in links point to the app on the same domain: example.com → app.example.com.
(() => {
  const host = location.hostname.replace(/^www\./, "");
  if (host.includes(".") && !host.endsWith("localhost")) {
    for (const a of document.querySelectorAll("[data-app-link]")) a.href = `https://app.${host}`;
  }
})();

// "Request early access" form: sent to the Orvanta app, which stores it.
(() => {
  const form = document.getElementById("ea-form");
  if (!form) return;
  const status = form.querySelector(".status");
  const button = form.querySelector('button[type="submit"]');
  const say = (text, kind) => {
    status.textContent = text;
    status.className = `status ${kind}`;
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const nameInput = form.elements.namedItem("name");
    const emailInput = form.elements.namedItem("email");
    const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    nameInput.setAttribute("aria-invalid", String(!name));
    emailInput.setAttribute("aria-invalid", String(!emailOk));
    if (!name || !emailOk) {
      say("Please enter your name and a valid work email.", "err");
      (name ? emailInput : nameInput).focus();
      return;
    }

    const body = {
      name,
      email,
      company: String(data.get("company") || "").trim(),
      tools: data.getAll("tools").map(String),
      fleet: String(data.get("fleet") || ""),
      message: String(data.get("message") || "").trim(),
      website: String(data.get("website") || ""),
    };

    button.disabled = true;
    say("Sending…", "");
    try {
      const res = await fetch("/api/public/early-access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        form.reset();
        say("Thanks! We'll be in touch soon.", "ok");
        return;
      }
      if (res.status === 429) say("You've sent several requests already. Please try again in an hour.", "err");
      else if (res.status === 400) say("Please check your name and email.", "err");
      else say("Something went wrong on our side. Please try again in a moment.", "err");
    } catch {
      say("We couldn't reach the server. Please check your connection and try again.", "err");
    } finally {
      button.disabled = false;
    }
  });
})();
