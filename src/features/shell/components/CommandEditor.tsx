import {
  Button,
  Checkbox,
  Dialog,
  Field,
  Input,
  Select,
  Textarea,
} from "@zovaris/sephiro";
import { type ReactNode, useState } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import type { CustomCommand } from "@/lib/types";

const FORM_ID = "pulso-command-editor";

function blank(projectId: number | null): CustomCommand {
  return {
    id: null,
    projectId,
    label: "",
    command: "",
    cwd: "",
    favorite: false,
  };
}

function EditorDialog({
  initial,
  onClose,
}: {
  initial: CustomCommand;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const projects = useStore((state) => state.projects);
  const save = useStore((state) => state.saveCustomCommand);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const change = (patch: Partial<CustomCommand>) =>
    setDraft((current) => ({ ...current, ...patch }));
  const ready = draft.label.trim() !== "" && draft.command.trim() !== "";

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(draft.id === null ? "newCommand" : "editCommand")}
      description={t("shellCommandHint")}
      closeLabel={t("cancel")}
      className="pulso-command-editor"
      footer={
        <>
          <Button
            size="sm"
            variant="quiet"
            type="button"
            disabled={saving}
            onClick={onClose}
          >
            {t("cancel")}
          </Button>
          <Button
            size="sm"
            variant="primary"
            type="submit"
            form={FORM_ID}
            disabled={saving || !ready}
          >
            {t(saving ? "savingCommand" : "saveCommand")}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!ready) return;
          setSaving(true);
          void save(draft)
            .then((ok) => {
              if (ok) onClose();
            })
            .finally(() => setSaving(false));
        }}
      >
        <Field label={t("commandName")} htmlFor="command-label">
          <Input
            id="command-label"
            size="sm"
            value={draft.label}
            required
            maxLength={160}
            autoFocus
            onChange={(event) => change({ label: event.target.value })}
          />
        </Field>
        <Field label={t("shellCommand")} htmlFor="command-shell">
          <Textarea
            id="command-shell"
            className="min-h-[72px] font-mono"
            value={draft.command}
            required
            placeholder="brew upgrade"
            spellCheck={false}
            onChange={(event) => change({ command: event.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("commandProject")} htmlFor="command-project">
            <Select
              id="command-project"
              size="sm"
              value={draft.projectId === null ? "" : String(draft.projectId)}
              onValueChange={(value) =>
                change({
                  projectId: value === "" ? null : Number(value),
                  cwd: "",
                })
              }
              options={[
                { value: "", label: t("personalCommands") },
                ...projects.map((project) => ({
                  value: String(project.id),
                  label: project.name,
                })),
              ]}
              ariaLabel={t("commandProject")}
            />
          </Field>
          <Field
            label={t("workingFolder")}
            htmlFor="command-cwd"
            description={t(
              draft.projectId === null ? "homeFolderHint" : "projectFolderHint",
            )}
          >
            <Input
              id="command-cwd"
              size="sm"
              className="font-mono"
              value={draft.cwd}
              placeholder={
                draft.projectId === null
                  ? "~"
                  : projects.find((project) => project.id === draft.projectId)
                      ?.path
              }
              onChange={(event) => change({ cwd: event.target.value })}
            />
          </Field>
        </div>
        <Checkbox
          label={t("menubarFavorite")}
          checked={draft.favorite}
          onChange={(event) => change({ favorite: event.target.checked })}
        />
      </form>
    </Dialog>
  );
}

/** Opening, editing and deleting custom commands, shared by every list of them. */
export function useCommandEditor(): {
  create: (projectId?: number | null) => void;
  edit: (command: CustomCommand) => void;
  remove: (command: CustomCommand) => void;
  dialogs: ReactNode;
} {
  const { t } = useI18n();
  const deleteCustomCommand = useStore((state) => state.deleteCustomCommand);
  const [draft, setDraft] = useState<CustomCommand | null>(null);
  const [removing, setRemoving] = useState<CustomCommand | null>(null);

  return {
    create: (projectId = null) => setDraft(blank(projectId)),
    edit: (command) => setDraft({ ...command }),
    remove: setRemoving,
    dialogs: (
      <>
        {draft ? (
          <EditorDialog
            key={draft.id ?? "new"}
            initial={draft}
            onClose={() => setDraft(null)}
          />
        ) : null}
        {removing ? (
          <ConfirmDialog
            title={t("deleteCommand")}
            body={t("deleteCommandBody", { label: removing.label })}
            confirmLabel={t("deleteCommand")}
            cancelLabel={t("cancel")}
            onCancel={() => setRemoving(null)}
            onConfirm={() => {
              if (removing.id === null) return;
              void deleteCustomCommand(removing.id).then((ok) => {
                if (ok) setRemoving(null);
              });
            }}
          />
        ) : null}
      </>
    ),
  };
}
