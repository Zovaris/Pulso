import { describe, expect, it } from "vitest";
import { t, translate } from "@/lib/i18n";

describe("translate", () => {
  it("reads plain keys", () => {
    expect(t("en", "appName")).toBe("Soffy");
    expect(t("es", "addProject")).toBe("Agregar proyecto");
  });

  it("walks dotted keys straight to the template", () => {
    expect(t("en", "runningCount.one")).toBe("{count} process running");
  });

  it("filters a plural through the locale rules", () => {
    expect(t("en", "runningCount", { count: 1 })).toBe("1 process running");
    expect(t("en", "runningCount", { count: 3 })).toBe("3 processes running");
    expect(t("es", "runningCount", { count: 2 })).toBe("2 procesos activos");
  });

  it("formats the numbers it interpolates", () => {
    expect(t("en", "runningCount", { count: 1234 })).toBe(
      "1,234 processes running",
    );
  });

  it("fills in named values", () => {
    expect(t("en", "openPort", { url: "http://localhost:4321" })).toBe(
      "Open http://localhost:4321",
    );
  });

  it("leaves an unknown placeholder alone", () => {
    expect(t("en", "openPort", {})).toBe("Open {url}");
  });

  it("returns the key when nothing matches", () => {
    expect(t("en", "notAKey")).toBe("notAKey");
    expect(translate("es", "notAKey")).toBe("notAKey");
  });
});
