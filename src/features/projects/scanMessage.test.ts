import { describe, expect, it } from "vitest";
import { scanMessage } from "@/features/projects/scanMessage";
import type { CommandScan, ScanStatus } from "@/lib/types";

function scan(status: ScanStatus, detail: string | null = null): CommandScan {
  return { projectId: 1, commands: [], status, detail, flags: {} };
}

describe("scanMessage", () => {
  it("says nothing when the commands were found", () => {
    expect(scanMessage(scan("detected"))).toBeNull();
  });

  it("lists what it reads when the folder declares nothing", () => {
    const message = scanMessage(scan("noManifest", "package.json, Makefile"));

    expect(message?.key).toBe("noManifest");
    expect(message?.detail).toBe("package.json, Makefile");
  });

  it("names the files that declare nothing", () => {
    const message = scanMessage(scan("noCommands", "package.json"));

    expect(message?.key).toBe("noCommands");
    expect(message?.detail).toBe("package.json");
  });

  it("separates a broken file from one that could not be opened", () => {
    expect(scanMessage(scan("invalidManifest", "not valid JSON"))?.key).toBe(
      "manifestBroken",
    );
    expect(scanMessage(scan("unreadable"))?.key).toBe("manifestUnreadable");
  });

  it("reports a folder that is gone", () => {
    expect(scanMessage(scan("unavailable"))?.key).toBe("projectMissing");
  });

  it("leaves the detail out when the backend sent none", () => {
    expect(scanMessage(scan("noManifest"))?.detail).toBeUndefined();
  });
});
