import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "@/app/store";
import type { CommandScan, CustomCommand } from "@/lib/types";
import { CommandsSection } from "./CommandsSection";

const save = vi.fn();
const setCommandFlag = vi.fn();
const remove = vi.fn();

const custom = (
  id: number,
  label: string,
  projectId: number | null,
  favorite = false,
): CustomCommand => ({
  id,
  projectId,
  label,
  command: `echo ${label}`,
  cwd: "",
  favorite,
});

const scan: CommandScan = {
  projectId: 5,
  status: "detected",
  detail: null,
  commands: [
    {
      id: "package_json:dev",
      label: "dev",
      program: "bun",
      args: ["run", "dev"],
      cwd: "/tmp/pulso",
      source: "package.json",
      detector: "package_json",
      category: "dev",
      longRunning: true,
    },
  ],
  flags: {},
};

beforeEach(() => {
  save.mockReset().mockResolvedValue(true);
  setCommandFlag.mockReset().mockResolvedValue(undefined);
  remove.mockReset().mockResolvedValue(true);
  useStore.setState({
    locale: "en",
    projects: [
      { id: 5, name: "Pulso", path: "/tmp/pulso", availability: "available" },
    ],
    scans: { "5": scan },
    customCommands: [custom(1, "brew", null)],
    executions: [],
    argsFor: null,
    saveCustomCommand: save,
    setCommandFlag,
    deleteCustomCommand: remove,
  });
});

const row = (name: string) =>
  screen.getAllByRole("row").find((entry) => within(entry).queryByText(name))!;

describe("commands catalog", () => {
  it("lists detected and custom commands together, each with its source", () => {
    render(<CommandsSection />);

    expect(within(row("dev")).getByText("package.json")).toBeTruthy();
    expect(within(row("dev")).getByText("Pulso")).toBeTruthy();
    expect(within(row("brew")).getByText("Custom")).toBeTruthy();
    expect(within(row("brew")).getByText("echo brew")).toBeTruthy();
  });

  it("narrows by kind and by what is typed", () => {
    render(<CommandsSection />);

    fireEvent.click(screen.getByRole("radio", { name: /^Custom/ }));
    expect(screen.queryByText("dev")).toBeNull();
    expect(row("brew")).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: /^All/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Find a command…" }), {
      target: { value: "bun run" },
    });
    expect(row("dev")).toBeTruthy();
    expect(screen.queryByText("brew")).toBeNull();
  });

  it("stars a detected command through its flags and a custom one through itself", () => {
    render(<CommandsSection />);

    fireEvent.click(
      within(row("dev")).getByRole("button", { name: /Add to favorites/ }),
    );
    expect(setCommandFlag).toHaveBeenCalledWith(5, "package_json:dev", {
      favorite: true,
    });

    fireEvent.click(
      within(row("brew")).getByRole("button", { name: /Add to favorites/ }),
    );
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, favorite: true }),
    );
  });

  it("offers edit and delete only for commands the user wrote", () => {
    render(<CommandsSection />);

    fireEvent.click(
      within(row("dev")).getByRole("button", { name: /More actions/ }),
    );
    expect(screen.queryByRole("menuitem", { name: "Edit command" })).toBeNull();
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });

    fireEvent.click(
      within(row("brew")).getByRole("button", { name: /More actions/ }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete command" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete command" }));

    expect(remove).toHaveBeenCalledWith(1);
  });

  it("saves a new personal favorite and preserves shell quoting", async () => {
    render(<CommandsSection />);
    fireEvent.click(screen.getByRole("button", { name: "New command" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Upgrade" },
    });
    fireEvent.change(screen.getByLabelText("Shell command"), {
      target: { value: "printf '%s' 'hello world'" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Save command" }));

    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        id: null,
        projectId: null,
        label: "Upgrade",
        command: "printf '%s' 'hello world'",
        cwd: "",
        favorite: true,
      }),
    );
    await waitFor(() => expect(screen.queryByLabelText("Name")).toBeNull());
  });

  it("keeps the draft open when storage rejects the command", async () => {
    save.mockResolvedValue(false);
    render(<CommandsSection />);
    fireEvent.click(screen.getByRole("button", { name: "New command" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Test" },
    });
    fireEvent.change(screen.getByLabelText("Shell command"), {
      target: { value: "pwd" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save command" }));

    await waitFor(() => expect(save).toHaveBeenCalled());
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(
      "Test",
    );
  });
});
