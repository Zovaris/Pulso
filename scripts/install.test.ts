import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("install.sh", "utf8");
const install = source.slice(
  source.indexOf("install_macos() {"),
  source.indexOf("# ── main"),
);
const cleanup = source.slice(
  source.indexOf("cleanup() {"),
  source.indexOf("trap cleanup EXIT"),
);

function simulate(
  mode: "success" | "invalid" | "copy-fails" | "replace-fails",
) {
  const script = `
set -euo pipefail
APPDIR=/existing
APP_NAME=Pulso
TMP_DIR=/scratch
BASE_URL=https://example.invalid
BOLD='' RESET=''
MOUNTPOINT='' STAGING='' BACKUP='' DEST_APP=''
MODE=${mode}
info() { :; }
ok() { :; }
warn() { printf 'warn\\n'; }
fail() { printf 'failed\\n'; exit 1; }
download() { :; }
verify_checksum() { :; }
mktemp() { printf '/scratch'; }
mkdir() { :; }
find() { printf '/source/Pulso.app\\n'; }
hdiutil() { printf '/dev/mock\\n'; }
strip_quarantine() { :; }
check_signature() {
  printf 'verify:%s\\n' "$1"
  if [[ "$MODE" == invalid ]]; then fail; fi
}
ditto() {
  printf 'copy\\n'
  if [[ "$MODE" == copy-fails ]]; then return 1; fi
}
quit_running() { :; }
running() { return 1; }
mv() {
  printf 'move:%s:%s\\n' "$1" "$2"
  if [[ "$MODE" == replace-fails && "$1" == /scratch/Pulso.app ]]; then return 1; fi
}
rm() { printf 'remove:%s\\n' "$*"; }
${install}
install_macos 0.2.1
`;
  try {
    return {
      success: true,
      output: execFileSync("bash", ["-c", script], { encoding: "utf8" }),
    };
  } catch (error) {
    return {
      success: false,
      output: String((error as { stdout: string }).stdout),
    };
  }
}

describe("installer", () => {
  it("verifies the source and staged bundle before replacing the destination", () => {
    const result = simulate("success");
    expect(result.success).toBe(true);
    expect(result.output.indexOf("verify:/source/Pulso.app")).toBeLessThan(
      result.output.indexOf("copy"),
    );
    expect(result.output.indexOf("verify:/scratch/Pulso.app")).toBeLessThan(
      result.output.indexOf("move:/scratch/Pulso.app"),
    );
    expect(result.output).not.toContain("remove:");
  });

  it.each(["invalid", "copy-fails"] as const)(
    "does not replace anything when %s",
    (mode) => {
      const result = simulate(mode);
      expect(result.success).toBe(false);
      expect(result.output).not.toContain("move:");
    },
  );

  it("fails explicitly when the final replacement fails", () => {
    const result = simulate("replace-fails");
    expect(result.success).toBe(false);
    expect(result.output).toContain("failed");
  });

  it("keeps the backup if restoring it fails", () => {
    const output = execFileSync(
      "bash",
      [
        "-c",
        `
set -euo pipefail
BACKUP=/bin/sh
DEST_APP=/pulso/nonexistent/destination
STAGING=/bin
MOUNTPOINT='' TMP_DIR=''
warn() { printf 'warn\\n'; }
mv() { return 1; }
rm() { printf 'removed\\n'; }
${cleanup}
cleanup
printf 'staging:%s\\n' "$STAGING"
`,
      ],
      { encoding: "utf8" },
    );
    expect(output).toContain("warn");
    expect(output).not.toContain("removed");
    expect(output).toContain("staging:\n");
  });
});
