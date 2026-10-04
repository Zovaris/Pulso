import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import {
  applyDocumentLocale,
  detectLocale,
  readStoredLocale,
} from "@/lib/i18n/locale";
import "@zovaris/sephiro/styles.css";
import "@/styles.css";

applyDocumentLocale(readStoredLocale() ?? detectLocale());

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);

if (
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).has("design")
) {
  void Promise.all([
    import("@/features/design-review/DesignReview"),
    import("@/features/design-review/demo"),
  ]).then(([{ DesignReview }, { installDesignDemo }]) => {
    installDesignDemo();
    root.render(
      <React.StrictMode>
        <DesignReview />
      </React.StrictMode>,
    );
  });
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
