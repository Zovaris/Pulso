import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { Button, Checkbox, Dialog, Field, Input } from "@zovaris/sephiro";
import { type ReactNode, useMemo, useState } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  catalogKey,
  catalogRows,
  filterCatalog,
} from "@/features/desktop/catalog";
import type { CommandGroup, GroupMember } from "@/lib/types";

const FORM_ID = "pulso-group-editor";

function EditorDialog({
  initial,
  onClose,
}: {
  initial: CommandGroup;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const projects = useStore((state) => state.projects);
  const scans = useStore((state) => state.scans);
  const customs = useStore((state) => state.customCommands);
  const save = useStore((state) => state.saveCommandGroup);
  const [label, setLabel] = useState(initial.label);
  const [members, setMembers] = useState<GroupMember[]>(initial.members);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const rows = useMemo(
    () => catalogRows(projects, scans, customs, t("personalCommands")),
    [projects, scans, customs, t],
  );
  const shown = filterCatalog(rows, { kind: "all", projectId: null, text });
  const order = new Map(
    members.map((member, index) => [
      catalogKey(member.projectId, member.commandId),
      index + 1,
    ]),
  );
  const ready = label.trim() !== "" && members.length > 0;

  const toggle = (projectId: number, commandId: string) => {
    const key = catalogKey(projectId, commandId);
    setMembers((current) =>
      order.has(key)
        ? current.filter(
            (member) => catalogKey(member.projectId, member.commandId) !== key,
          )
        : [...current, { projectId, commandId }],
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(initial.id === null ? "newGroup" : "editGroup")}
      description={t("groupPick")}
      closeLabel={t("cancel")}
      className="pulso-command-editor"
      footer={
        <>
          <span className="mr-auto text-[12px] text-faint">
            {t("groupSelected", { count: members.length })}
          </span>
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
            {t(saving ? "savingCommand" : "saveGroup")}
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
          void save({ id: initial.id, label, members })
            .then((ok) => {
              if (ok) onClose();
            })
            .finally(() => setSaving(false));
        }}
      >
        <Field label={t("groupName")} htmlFor="group-label">
          <Input
            id="group-label"
            size="sm"
            value={label}
            required
            maxLength={80}
            autoFocus
            placeholder={t("groupNamePlaceholder")}
            onChange={(event) => setLabel(event.target.value)}
          />
        </Field>
        <Field label={t("groupCommands")} htmlFor="group-search">
          <label className="pulso-search w-full!">
            <MagnifyingGlassIcon size={13} aria-hidden />
            <Input
              id="group-search"
              size="sm"
              value={text}
              placeholder={t("searchCommands")}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
        </Field>
        <ul className="pulso-group-picker" aria-label={t("groupCommands")}>
          {shown.map((row) => {
            const position = order.get(row.key);
            return (
              <li key={row.key}>
                <Checkbox
                  size="sm"
                  checked={position !== undefined}
                  onChange={() => toggle(row.projectId, row.command.id)}
                  label={
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="truncate font-medium">
                        {row.command.label}
                      </span>
                      <span className="truncate text-faint">
                        {row.projectName}
                      </span>
                    </span>
                  }
                />
                {position !== undefined ? (
                  <span className="pulso-group-picker__order">{position}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </form>
    </Dialog>
  );
}

/** Creating, editing and deleting command groups, shared by every place that lists them. */
export function useGroupEditor(): {
  create: () => void;
  edit: (group: CommandGroup) => void;
  remove: (group: CommandGroup) => void;
  dialogs: ReactNode;
} {
  const { t } = useI18n();
  const deleteCommandGroup = useStore((state) => state.deleteCommandGroup);
  const [draft, setDraft] = useState<CommandGroup | null>(null);
  const [removing, setRemoving] = useState<CommandGroup | null>(null);

  return {
    create: () => setDraft({ id: null, label: "", members: [] }),
    edit: (group) => setDraft({ ...group, members: [...group.members] }),
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
            title={t("deleteGroup")}
            body={t("deleteGroupBody", { label: removing.label })}
            confirmLabel={t("deleteGroup")}
            cancelLabel={t("cancel")}
            onCancel={() => setRemoving(null)}
            onConfirm={() => {
              if (removing.id === null) return;
              void deleteCommandGroup(removing.id).then((ok) => {
                if (ok) setRemoving(null);
              });
            }}
          />
        ) : null}
      </>
    ),
  };
}
