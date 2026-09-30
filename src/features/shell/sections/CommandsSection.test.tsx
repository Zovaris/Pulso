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
