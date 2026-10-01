import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useStore } from "@/app/store";
import { CommandPalette } from "@/features/shell/components/CommandPalette";
import type { CommandScan, Project } from "@/lib/types";

const project = (id: number, name: string): Project =>
  ({ id, name, path: `/p/${name}`, availability: "available" }) as Project;

const scan = (projectId: number, labels: string[]): CommandScan =>
  ({
    projectId,
    commands: labels.map((label) => ({
      id: `${projectId}:${label}`,
      label,
      program: "make",
      args: [label],
      cwd: `/p/${projectId}`,
      source: "Makefile",
      detector: "makefile",
      category: "dev",
      longRunning: false,
    })),
    status: "detected",
    detail: null,
    flags: {},
  }) as CommandScan;

const PROJECTS = [
  project(1, "justcallmebryan"),
  project(2, "design-atlas"),
  project(3, "Pulso"),
  project(4, "Gigi"),
];

const SCANS: Record<string, CommandScan> = {
  "1": scan(1, [
    "dev",
    "dev:force",
    "preview",
    "test:watch",
    "test",
    "format",
    "lint",
    "lint:fix",
  ]),
  "2": scan(2, ["build", "dev", "preview", "lint", "check", "format"]),
  "3": scan(3, [
    "dev",
    "build",
    "test",
    "lint",
    "typecheck",
    "format",
    "check",
    "preview",
    "bench",
    "e2e",
    "storybook",
    "clean",
    "start",
    "release",
  ]),
  "4": scan(4, ["test", "check", "build", "clean", "help", "icon"]),
};

function open(): HTMLInputElement {
  useStore.setState({
    locale: "en",
    paletteOpen: true,
    projects: PROJECTS,
    scans: SCANS,
    customCommands: [],
    executions: [],
  } as never);
  render(<CommandPalette />);
  return screen.getByRole("combobox");
}

const results = () => screen.queryAllByRole("option");

describe("CommandPalette", () => {
  it("offers a short list until something is typed", () => {
    const input = open();

    expect(results()).toHaveLength(8);
    expect(input).toBeTruthy();
  });

  it("searches every project, not only the ones it suggests", () => {
    const input = open();

    fireEvent.change(input, { target: { value: "check" } });

    // design-atlas, Pulso and Gigi all have one, plus typecheck.
    expect(results()).toHaveLength(4);
  });

  it("finds a command that exists in a single project", () => {
    const input = open();

    fireEvent.change(input, { target: { value: "storybook" } });

    expect(results()).toHaveLength(1);
  });

  it("narrows again as the query gets longer", () => {
    const input = open();

    fireEvent.change(input, { target: { value: "b" } });
    const loose = results().length;
    fireEvent.change(input, { target: { value: "storybook" } });

    expect(loose).toBeGreaterThan(results().length);
  });
});
