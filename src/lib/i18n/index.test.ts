import { describe, expect, it } from "vitest";
import { t, translate } from "@/lib/i18n";

describe("translate", () => {
  it("reads plain keys", () => {
    expect(t("en", "appName")).toBe("Pulso");
    expect(t("es", "addProject")).toBe("Agregar proyecto");
  });

  it("walks dotted keys straight to the template", () => {
    expect(t("en", "commandCount.one")).toBe("{count} command");
  });

  it("filters a plural through the locale rules", () => {
    expect(t("en", "commandCount", { count: 1 })).toBe("1 command");
    expect(t("en", "commandCount", { count: 3 })).toBe("3 commands");
    expect(t("es", "commandCount", { count: 2 })).toBe("2 comandos");
  });

  it("formats the numbers it interpolates", () => {
    expect(t("en", "commandCount", { count: 1234 })).toBe("1,234 commands");
  });

  it("fills in named values", () => {
    expect(t("en", "menuOpenPort", { port: "4321" })).toBe(
      "Open localhost:4321",
    );
  });

  it("leaves an unknown placeholder alone", () => {
    expect(t("en", "menuOpenPort", {})).toBe("Open localhost:{port}");
  });

  it("returns the key when nothing matches", () => {
    expect(t("en", "notAKey")).toBe("notAKey");
    expect(translate("es", "notAKey")).toBe("notAKey");
  });
});
