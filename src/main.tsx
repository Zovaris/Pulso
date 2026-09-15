import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import {
  applyDocumentLocale,
  detectLocale,
  readStoredLocale,
} from "@/lib/i18n/locale";
import "@/styles.css";

applyDocumentLocale(readStoredLocale() ?? detectLocale());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
