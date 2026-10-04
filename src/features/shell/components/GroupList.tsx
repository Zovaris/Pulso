import {
  DotsThreeIcon,
  PencilSimpleIcon,
  PlayIcon,
  StopIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { Button, IconButton, Menu } from "@zovaris/sephiro";
import { useState } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import type { CatalogRow } from "@/features/desktop/catalog";
import { groupStatus } from "@/features/desktop/groups";
import type { CommandGroup } from "@/lib/types";

function GroupRow({
  group,
  rows,
  onEdit,
  onRemove,
  onStop,
}: {
  group: CommandGroup;
  rows: CatalogRow[];
  onEdit: () => void;
  onRemove: () => void;
  onStop: () => void;
}) {
  const { t } = useI18n();
  const executions = useStore((state) => state.executions);
  const startGroup = useStore((state) => state.startGroup);
  const status = groupStatus(group, rows, executions);
  const active = status.running > 0;
  const missing = status.total < group.members.length;

  return (
    <li className="pulso-group-row">
      <i className="pulso-dot" data-s={active ? "running" : "exited"} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{group.label}</p>
        <p
          className="truncate text-[12px] text-faint"
          title={missing ? t("groupMissing") : undefined}
        >
          {status.rows.map((row, index) => (
            <span key={row.key}>
              {index ? " · " : ""}
              <span className="text-mist">{row.command.label}</span>{" "}
              {row.projectName}
            </span>
          ))}
        </p>
      </div>
      <span className="flex-none text-[12px] text-faint tabular-nums">
        {active
          ? t("groupRunning", { running: status.running, total: status.total })
          : t("groupIdle", { count: status.total })}
      </span>
      {active && status.running < status.total ? (
        <Button
          size="sm"
          variant="quiet"
          motion="none"
          onClick={() => void startGroup(group)}
        >
          {t("startMissing")}
        </Button>
      ) : null}
      <Button
        size="sm"
        variant={active ? "secondary" : "quiet"}
        motion="none"
        className="pulso-run-button"
        disabled={status.total === 0}
        onClick={() => (active ? onStop() : void startGroup(group))}
      >
        {active ? (
          <StopIcon size={11} weight="fill" />
        ) : (
          <PlayIcon size={11} weight="fill" />
        )}
        {t(active ? "stopCommand" : "runCommand")}
      </Button>
      <Menu
        label={`${t("moreActions")} · ${group.label}`}
        align="end"
        trigger={
          <IconButton
            size="sm"
            variant="ghost"
            icon={<DotsThreeIcon size={16} weight="bold" />}
            label={`${t("moreActions")} · ${group.label}`}
            title={t("moreActions")}
          />
        }
        items={[
          {
            value: "edit",
            label: t("editGroup"),
            icon: <PencilSimpleIcon size={15} />,
          },
          {
            value: "delete",
            label: t("deleteGroup"),
            icon: <TrashIcon size={15} />,
            danger: true,
          },
        ]}
        onSelect={(value) => (value === "edit" ? onEdit() : onRemove())}
      />
    </li>
  );
}

/** Groups of commands that start and stop together. Stopping asks first when the user wants to be asked. */
export function GroupList({
  groups,
  rows,
  onEdit,
  onRemove,
}: {
  groups: CommandGroup[];
  rows: CatalogRow[];
  onEdit: (group: CommandGroup) => void;
  onRemove: (group: CommandGroup) => void;
}) {
  const { t } = useI18n();
  const confirmStop = useStore((state) => state.confirmStop);
  const stopGroup = useStore((state) => state.stopGroup);
  const [stopping, setStopping] = useState<CommandGroup | null>(null);

  return (
    <>
      <ul className="pulso-group-list" aria-label={t("groupsTitle")}>
        {groups.map((group) => (
          <GroupRow
            key={group.id}
            group={group}
            rows={rows}
            onEdit={() => onEdit(group)}
            onRemove={() => onRemove(group)}
            onStop={() =>
              confirmStop ? setStopping(group) : void stopGroup(group)
            }
          />
        ))}
      </ul>
      {stopping ? (
        <ConfirmDialog
          title={`${t("stopGroup")} · ${stopping.label}`}
          body={t("confirmStopAllBody")}
          confirmLabel={t("stopGroup")}
          cancelLabel={t("cancel")}
          onCancel={() => setStopping(null)}
          onConfirm={() => {
            void stopGroup(stopping);
            setStopping(null);
          }}
        />
      ) : null}
    </>
  );
}
