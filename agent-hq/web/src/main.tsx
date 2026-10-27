import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { loadLocale } from "./i18n.ts";
import "./styles.css";

// Texts and amounts depend on the server's language: load it before the first render.
void loadLocale().then(() =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
