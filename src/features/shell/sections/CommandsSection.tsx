import {
  PencilSimpleIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { Button } from "@zovaris/sephiro";
import { useState } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { IconTool } from "@/components/shared/IconTool";
import { customDetected } from "@/features/desktop/customCommands";
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
const FIELD =
  "mt-1 w-full rounded-[7px] border border-line bg-void px-3 py-2 text-[12px] text-paper outline-none focus:border-accent";

export function CommandsSection() {
  const { t } = useI18n();
  const commands = useStore((s) => s.customCommands);
  const remove = useStore((s) => s.deleteCustomCommand);
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
      <div className="mt-5 flex flex-col gap-3">
        {commands.map((command) => (
          <CommandEntry
            key={command.id}
            command={command}
            editing={draft !== null}
            onEdit={(command) => setDraft({ ...command })}
            onRemove={setRemoving}
          />
        ))}
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
      <label className="block">
        {t("commandName")}
        <input
          className={FIELD}
          value={draft.label}
          required
          maxLength={160}
          onChange={(e) => change({ label: e.target.value })}
        />
      </label>
      <label className="mt-3 block">
        {t("shellCommand")}
        <textarea
          className={`${FIELD} min-h-[74px] font-mono`}
          value={draft.command}
          required
          placeholder="brew upgrade"
          spellCheck={false}
          onChange={(e) => change({ command: e.target.value })}
        />
      </label>
      <label className="mt-3 block">
        {t("commandProject")}
        <select
          className={FIELD}
          value={draft.projectId ?? ""}
          onChange={(e) =>
            change({
              projectId: e.target.value === "" ? null : Number(e.target.value),
              cwd: "",
            })
          }
        >
          <option value="">{t("personalCommands")}</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block">
        {t("workingFolder")}
        <input
          className={`${FIELD} font-mono`}
          value={draft.cwd}
          placeholder={
            draft.projectId === null
              ? "~"
              : projects.find((p) => p.id === draft.projectId)?.path
          }
          onChange={(e) => change({ cwd: e.target.value })}
        />
      </label>
      <p className="mt-1.5 text-mist">
        {t(draft.projectId === null ? "homeFolderHint" : "projectFolderHint")}
      </p>
      <label className="mt-4 flex items-center gap-2">
        <input
          type="checkbox"
          className="accent-accent"
          checked={draft.favorite}
          onChange={(e) => change({ favorite: e.target.checked })}
        />
        {t("menubarFavorite")}
      </label>
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
  const projects = useStore((s) => s.projects);
  const executions = useStore((s) => s.executions);
  const save = useStore((s) => s.saveCustomCommand);
  const scope = command.projectId ?? 0;
  const detected = customDetected(command);
  const execution = latestExecution(executions, scope, detected.id);
  const active = execution ? isActiveState(execution.state) : false;
  return (
    <div className="border-b border-hairline pb-3">
      <div className="mb-1 flex items-center gap-2 text-[11px] text-mist">
        <span>
          {projects.find((p) => p.id === command.projectId)?.name ??
            t("personalCommands")}
        </span>
        <span className="min-w-0 flex-1 truncate font-mono" title={command.cwd}>
          {command.cwd}
        </span>
        <button
          type="button"
          aria-label={t("menubarFavorite")}
          aria-pressed={command.favorite}
          disabled={active || editing}
          className="rounded p-1 text-accent-strong disabled:opacity-40"
          onClick={() => void save({ ...command, favorite: !command.favorite })}
        >
          <StarIcon size={14} weight={command.favorite ? "fill" : "regular"} />
        </button>
        <IconTool
          icon={PencilSimpleIcon}
          label={t("editCommand")}
          disabled={active || editing}
          onClick={() => onEdit(command)}
        />
        <IconTool
          icon={TrashIcon}
          label={t("deleteCommand")}
          disabled={active}
          onClick={() => onRemove(command)}
        />
      </div>
      <CommandRow projectId={scope} command={detected} />
    </div>
  );
}
