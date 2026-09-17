import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const script = path.resolve("scripts/validate-commit-message.mjs");

function run(message: string): { accepted: boolean; stderr: string } {
  const directory = mkdtempSync(path.join(tmpdir(), "pulso-commit-"));
  const file = path.join(directory, "COMMIT_EDITMSG");
  writeFileSync(file, message);

  try {
    execFileSync(process.execPath, [script, file], { stdio: "pipe" });
    return { accepted: true, stderr: "" };
  } catch (error) {
    return {
      accepted: false,
      stderr: String((error as { stderr?: Buffer }).stderr ?? ""),
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const fill = (length: number) => "a".repeat(length);

describe("validate-commit-message", () => {
  it("accepts a title alone", () => {
    expect(run("feat(popover): open the port from the row").accepted).toBe(
      true,
    );
  });

  it("accepts two hundred characters", () => {
    expect(run(fill(200)).accepted).toBe(true);
  });

  it("counts characters rather than bytes", () => {
    expect(run(`${fill(199)}á`).accepted).toBe(true);
  });

  it("ignores the comments git adds to the file", () => {
    expect(run("# a comment\n\nfeat: something\n").accepted).toBe(true);
  });

  it("rejects an empty message before git does", () => {
    expect(run("# just a comment\n").accepted).toBe(false);
  });

  it("rejects two hundred and one characters", () => {
    expect(run(fill(201)).stderr).toContain("201 characters");
  });

  it("rejects a body under the title", () => {
    expect(run("feat: a title\n\nand then a paragraph\n").stderr).toContain(
      "title and nothing else",
    );
  });

  it("rejects a co-author trailer", () => {
    expect(
      run("feat: a title\n\nCo-Authored-By: X <x@example.com>\n").stderr,
    ).toContain("no co-author trailer");
  });

  it("rejects a generated-by footer", () => {
    expect(run("feat: a title\n\nGenerated with Codebuff\n").stderr).toContain(
      "no generated-by footer",
    );
  });

  it("lets git-written messages carry a body", () => {
    expect(
      run(`Merge branch 'feature/a-long-name'\n\n${fill(300)}\n`).accepted,
    ).toBe(true);
  });

  it("lets git rewrite a long title into a fixup or a squash", () => {
    expect(run(`fixup! ${fill(250)}\n`).accepted).toBe(true);
    expect(run(`squash! ${fill(250)}\n`).accepted).toBe(true);
  });

  it("lets a revert through", () => {
    expect(run('Revert "feat(popover): something"\n').accepted).toBe(true);
  });
});
