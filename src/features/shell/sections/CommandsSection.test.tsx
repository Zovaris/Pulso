import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useStore } from "@/app/store";
import { CommandsSection } from "./CommandsSection";

const save = vi.fn();
beforeEach(() => {
  save.mockReset().mockResolvedValue(true);
  useStore.setState({
    locale: "en",
    projects: [
      { id: 5, name: "Pulso", path: "/tmp/pulso", availability: "available" },
    ],
    customCommands: [],
    executions: [],
    saveCustomCommand: save,
  });
});
it("saves a personal favorite with home as the default and preserves shell quoting", async () => {
  render(<CommandsSection />);
  fireEvent.click(screen.getAllByRole("button", { name: "Add command" })[0]);
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
it("keeps the draft visible when storage rejects the command", async () => {
  save.mockResolvedValue(false);
  render(<CommandsSection />);
  fireEvent.click(screen.getAllByRole("button", { name: "Add command" })[0]);
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Test" },
  });
  fireEvent.change(screen.getByLabelText("Shell command"), {
    target: { value: "pwd" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Project" }));
  fireEvent.click(screen.getByRole("option", { name: "Pulso" }));
  fireEvent.click(screen.getByRole("button", { name: "Save command" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 5, cwd: "" }),
    ),
  );
  expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(
    "Test",
  );
});

const command = (
  id: number,
  label: string,
  cwd: string,
  favorite: boolean,
) => ({
  id,
  projectId: null,
  label,
  command: label,
  cwd,
  favorite,
});

const stars = () => screen.getAllByRole("button", { name: /favorite in the/i });

it("favourites every command of a group at once", async () => {
  useStore.setState({
    customCommands: [
      command(1, "brew update", "/Users/example", false),
      command(2, "brew upgrade", "/Users/example", false),
    ],
  } as never);
  render(<CommandsSection />);

  fireEvent.click(stars()[0]);

  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls.map(([c]) => c.label)).toEqual([
    "brew update",
    "brew upgrade",
  ]);
  expect(save.mock.calls.every(([c]) => c.favorite === true)).toBe(true);
});

it("unfavourites the group only when every command is already one", async () => {
  useStore.setState({
    customCommands: [
      command(1, "brew update", "/Users/example", true),
      command(2, "brew upgrade", "/Users/example", false),
    ],
  } as never);
  render(<CommandsSection />);

  fireEvent.click(stars()[0]);

  // Mixed group: only the one that is not a favorite yet gets written.
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(save.mock.calls[0][0].label).toBe("brew upgrade");

  save.mockClear();
  useStore.setState({
    customCommands: [
      command(1, "brew update", "/Users/example", true),
      command(2, "brew upgrade", "/Users/example", true),
    ],
  } as never);
  render(<CommandsSection />);

  fireEvent.click(stars()[1]);

  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls.every(([c]) => c.favorite === false)).toBe(true);
});

it("keeps one star per group, not one per command", () => {
  useStore.setState({
    customCommands: [
      command(1, "brew update", "/Users/example", false),
      command(2, "brew upgrade", "/Users/example", false),
      command(3, "make test", "/tmp", false),
    ],
  } as never);
  render(<CommandsSection />);

  expect(stars()).toHaveLength(2);
});
