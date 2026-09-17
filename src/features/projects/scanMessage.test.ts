import { describe, expect, it } from "vitest";
import { scanMessage } from "@/features/projects/scanMessage";
import type { CommandScan, ScanStatus } from "@/lib/types";

function scan(status: ScanStatus, detail: string | null = null): CommandScan {
  return { projectId: 1, commands: [], status, detail };
}

describe("scanMessage", () => {
  it("says nothing when the commands were found", () => {
    expect(scanMessage(scan("detected"))).toBeNull();
  });

  it("points at the Node-only limit when there is no manifest", () => {
    expect(scanMessage(scan("noManifest"))).toEqual({
      key: "noManifest",
      hint: "nodeOnlyHint",
    });
  });

  it("distinguishes an empty manifest from a broken one", () => {
    expect(scanMessage(scan("noCommands"))).toEqual({ key: "noCommands" });
  });

  it("carries the reason the manifest was refused", () => {
    expect(scanMessage(scan("invalidManifest", "line 4"))?.detail).toBe(
      "line 4",
    );
    expect(scanMessage(scan("unreadable"))?.key).toBe("manifestUnreadable");
  });

  it("reports a folder that is gone", () => {
    expect(scanMessage(scan("unavailable"))?.key).toBe("projectMissing");
  });
});
