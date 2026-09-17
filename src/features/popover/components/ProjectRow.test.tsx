import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "@/app/store";
import { ProjectRow } from "@/features/popover/components/ProjectRow";
import type { CommandScan, DetectedCommand, Project } from "@/lib/types";

const project: Project = {
  id: 1,
  name: "Apex",
  path: "/Users/sthbryan/Documents/Codes/Apex",
  availability: "available",
};

function command(id: string, source: string, label: string): DetectedCommand {
  return {
    id,
    label,
    program: "bun",
    args: ["run", label],
    cwd: project.path,
    source,
    detector: "package_json",
    category: "other",
    longRunning: false,
  };
}

function scan(commands: DetectedCommand[]): CommandScan {
  return {
    projectId: 1,
    commands,
    status: "detected",
    detail: null,
    flags: {},
  };
}

beforeEach(() => {
  useStore.setState({ locale: "en", scans: {}, expandedProjectId: 1 });
});

describe("ProjectRow", () => {
  it("names the file each group of commands came from", () => {
    useStore.setState({
      scans: {
        "1": scan([
          command("dev", `${project.path}/package.json`, "dev"),
          command("test:rust", `${project.path}/Cargo.toml`, "test"),
        ]),
      },
    });

    const { container } = render(<ProjectRow project={project} />);

    expect(screen.getByText("package.json")).toBeTruthy();
    expect(screen.getByText("Cargo.toml")).toBeTruthy();
    expect(container.querySelectorAll(".pulso-source")).toHaveLength(2);
  });

  it("stays quiet when one file declares everything", () => {
    useStore.setState({
      scans: {
        "1": scan([
          command("dev", `${project.path}/package.json`, "dev"),
          command("build", `${project.path}/package.json`, "build"),
        ]),
      },
    });

    const { container } = render(<ProjectRow project={project} />);

    expect(container.querySelectorAll(".pulso-source")).toHaveLength(0);
    expect(screen.getByText("dev")).toBeTruthy();
    expect(screen.getByText("build")).toBeTruthy();
  });
});
