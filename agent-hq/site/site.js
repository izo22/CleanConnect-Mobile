// Sign-in and sign-up links point to the app on the same domain: example.com → app.example.com.
(() => {
  const host = location.hostname.replace(/^www\./, "");
  if (host.includes(".") && !host.endsWith("localhost")) {
    for (const a of document.querySelectorAll("[data-app-link]")) a.href = `https://app.${host}${a.dataset.appLink || ""}`;
  }
})();

// The site's forms ("Book a setup call", "Contact us"): sent to the Orvanta app, which stores them.
document.querySelectorAll("form[data-lead]").forEach((form) => {
  const kind = form.dataset.lead;
  const status = form.querySelector(".status");
  const button = form.querySelector('button[type="submit"]');
  const say = (text, cls) => {
    status.textContent = text;
    status.className = `status ${cls}`;
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const message = String(data.get("message") || "").trim();
    const nameInput = form.elements.namedItem("name");
    const emailInput = form.elements.namedItem("email");
    const messageInput = form.elements.namedItem("message");
    const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    const messageOk = kind !== "contact" || message.length > 0;
    nameInput.setAttribute("aria-invalid", String(!name));
    emailInput.setAttribute("aria-invalid", String(!emailOk));
    if (messageInput) messageInput.setAttribute("aria-invalid", String(!messageOk));
    if (!name || !emailOk || !messageOk) {
      say(kind === "contact" ? "Please enter your name, a valid email and your message." : "Please enter your name and a valid work email.", "err");
      (!name ? nameInput : !emailOk ? emailInput : messageInput).focus();
      return;
    }

    const body = {
      kind,
      name,
      email,
      company: String(data.get("company") || "").trim(),
      message,
      website: String(data.get("website") || ""),
    };
    if (kind === "contact") body.role = String(data.get("role") || "");
    else {
      body.tools = data.getAll("tools").map(String);
      body.fleet = String(data.get("fleet") || "");
    }

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
        say(kind === "contact" ? "Thanks! Your message is on its way. We usually reply within one business day." : "Thanks! We'll be in touch soon.", "ok");
        return;
      }
      if (res.status === 429) say("You've sent several messages already. Please try again in an hour.", "err");
      else if (res.status === 400) say("Please check your name, email and message.", "err");
      else say("Something went wrong on our side. Please try again in a moment, or email orvanta.contact@gmail.com.", "err");
    } catch {
      say("We couldn't reach the server. Please check your connection, or email orvanta.contact@gmail.com.", "err");
    } finally {
      button.disabled = false;
    }
  });
});

// The hero demo video: respect people who ask for less motion.
(function () {
  var v = document.querySelector("video.demo");
  if (v && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { v.removeAttribute("autoplay"); v.pause(); v.controls = true; }
})();
