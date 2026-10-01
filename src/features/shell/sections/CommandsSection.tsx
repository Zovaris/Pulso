import {
  PencilSimpleIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import {
  Button,
  Checkbox,
  Field,
  IconButton,
  Input,
  Select,
  Textarea,
} from "@zovaris/sephiro";
import { useMemo, useState } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { IconTool } from "@/components/shared/IconTool";
import {
  customDetected,
  groupCustomCommands,
} from "@/features/desktop/customCommands";
import {
  isActiveState,
  latestExecution,
} from "@/features/executions/execution";
import { CommandRow } from "@/features/popover/components/CommandRow";
import type { CustomCommand } from "@/lib/types";

const EMPTY: CustomCommand = {
  id: null,
  projectId: null,
  label: "",
  command: "",
  cwd: "",
  favorite: false,
};
export function CommandsSection() {
  const { t } = useI18n();
  const commands = useStore((s) => s.customCommands);
  const projects = useStore((s) => s.projects);
  const remove = useStore((s) => s.deleteCustomCommand);
  const save = useStore((s) => s.saveCustomCommand);
  const groups = useMemo(() => groupCustomCommands(commands), [commands]);
  const [draft, setDraft] = useState<CustomCommand | null>(null);
  const [removing, setRemoving] = useState<CustomCommand | null>(null);

  return (
    <div className="pulso-pane flex min-w-0 flex-1 flex-col overflow-auto px-6 py-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[16px] font-semibold">{t("sectionCommands")}</h1>
          <p className="mt-1 text-[12px] text-mist">
            {t("customCommandsLede")}
          </p>
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={() => setDraft({ ...EMPTY })}
          disabled={draft !== null}
        >
          <PlusIcon size={14} />
          {t("addCommand")}
        </Button>
      </header>
      {draft ? (
        <CommandEditor
          key={draft.id ?? "new"}
          initial={draft}
          onClose={() => setDraft(null)}
        />
      ) : null}
      {commands.length === 0 && !draft ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
          <h2 className="text-[14px] font-medium">{t("noCustomCommands")}</h2>
          <p className="max-w-[340px] text-[12px] text-mist">
            {t("customCommandsEmpty")}
          </p>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setDraft({ ...EMPTY })}
          >
            {t("addCommand")}
          </Button>
        </div>
      ) : null}
      <div className="mt-5 flex flex-col gap-5">
        {groups.map((group) => {
          const favorites = group.commands.filter(
            (command) => command.favorite,
          ).length;
          const every = favorites === group.commands.length;
          const favorite = !every;

          return (
            <section key={group.key}>
              <header className="mb-2 flex items-center gap-2 text-[11px] text-mist">
                <span>
                  {projects.find((p) => p.id === group.projectId)?.name ??
                    t("personalCommands")}
                </span>
                <span
                  className="min-w-0 flex-1 truncate font-mono"
                  title={group.cwd}
                >
                  {group.cwd}
                </span>
                <IconButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  label={t("menubarFavorite")}
                  aria-pressed={every}
                  disabled={draft !== null}
                  onClick={() => {
                    void (async () => {
                      for (const command of group.commands) {
                        if (command.favorite === favorite) continue;
                        await save({ ...command, favorite });
                      }
                    })();
                  }}
                  icon={
                    <StarIcon
                      size={14}
                      weight={
                        every ? "fill" : favorites > 0 ? "duotone" : "regular"
                      }
                    />
                  }
                  className="text-accent-strong"
                />
              </header>
              <div className="flex flex-col gap-3">
                {group.commands.map((command) => (
                  <CommandEntry
                    key={command.id}
                    command={command}
                    editing={draft !== null}
                    onEdit={(command) => setDraft({ ...command })}
                    onRemove={setRemoving}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {removing ? (
        <ConfirmDialog
          title={t("deleteCommand")}
          body={t("deleteCommandBody", { label: removing.label })}
          confirmLabel={t("deleteCommand")}
          cancelLabel={t("cancel")}
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            if (removing.id !== null)
              void remove(removing.id).then((ok) => {
                if (ok) {
                  setRemoving(null);
                  if (draft?.id === removing.id) setDraft(null);
                }
              });
          }}
        />
      ) : null}
    </div>
  );
}

function CommandEditor({
  initial,
  onClose,
}: {
  initial: CustomCommand;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const projects = useStore((s) => s.projects);
  const save = useStore((s) => s.saveCustomCommand);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const change = (patch: Partial<CustomCommand>) =>
    setDraft((current) => ({ ...current, ...patch }));
  return (
    <form
      className="my-5 max-w-[600px] border-b border-line pb-5 text-[12px]"
      onSubmit={(event) => {
        event.preventDefault();
        setSaving(true);
        void save(draft)
          .then((ok) => {
            if (ok) onClose();
          })
          .finally(() => setSaving(false));
      }}
    >
      <h2 className="mb-4 font-medium">
        {t(draft.id === null ? "addCommand" : "editCommand")}
      </h2>
      <Field label={t("commandName")} htmlFor="command-label">
        <Input
          id="command-label"
          value={draft.label}
          required
          maxLength={160}
          onChange={(e) => change({ label: e.target.value })}
        />
      </Field>
      <Field label={t("shellCommand")} htmlFor="command-shell" className="mt-3">
        <Textarea
          id="command-shell"
          className="min-h-[74px] font-mono"
          value={draft.command}
          required
          placeholder="brew upgrade"
          spellCheck={false}
          onChange={(e) => change({ command: e.target.value })}
        />
      </Field>
      <Field
        label={t("commandProject")}
        htmlFor="command-project"
        className="mt-3"
      >
        <Select
          id="command-project"
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
      <Field label={t("workingFolder")} htmlFor="command-cwd" className="mt-3">
        <Input
          id="command-cwd"
          className="font-mono"
          value={draft.cwd}
          placeholder={
            draft.projectId === null
              ? "~"
              : projects.find((p) => p.id === draft.projectId)?.path
          }
          onChange={(e) => change({ cwd: e.target.value })}
        />
      </Field>
      <p className="mt-1.5 text-mist">
        {t(draft.projectId === null ? "homeFolderHint" : "projectFolderHint")}
      </p>
      <Checkbox
        className="mt-4"
        label={t("menubarFavorite")}
        checked={draft.favorite}
        onChange={(e) => change({ favorite: e.target.checked })}
      />
      <p className="mt-3 text-mist">{t("shellCommandHint")}</p>
      <div className="mt-4 flex gap-2">
        <Button
          size="sm"
          variant="primary"
          type="submit"
          disabled={saving || !draft.label.trim() || !draft.command.trim()}
        >
          {t(saving ? "savingCommand" : "saveCommand")}
        </Button>
        <Button size="sm" type="button" disabled={saving} onClick={onClose}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
function CommandEntry({
  command,
  editing,
  onEdit,
  onRemove,
}: {
  command: CustomCommand;
  editing: boolean;
  onEdit: (command: CustomCommand) => void;
  onRemove: (command: CustomCommand) => void;
}) {
  const { t } = useI18n();
  const executions = useStore((s) => s.executions);
  const scope = command.projectId ?? 0;
  const detected = customDetected(command);
  const execution = latestExecution(executions, scope, detected.id);
  const active = execution ? isActiveState(execution.state) : false;
  return (
    <div className="border-b border-hairline pb-3 last:border-b-0">
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <CommandRow projectId={scope} command={detected} />
        </div>
        <div className="flex flex-none items-center gap-1 mt-0.75">
          <IconTool
            icon={PencilSimpleIcon}
            label={t("editCommand")}
            disabled={active || editing}
            size={11}
            className="size-5.5!"
            onClick={() => onEdit(command)}
          />
          <IconTool
            icon={TrashIcon}
            label={t("deleteCommand")}
            disabled={active}
            size={11}
            className="size-5.5!"
            onClick={() => onRemove(command)}
          />
        </div>
      </div>
    </div>
  );
}
