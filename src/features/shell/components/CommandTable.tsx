import {
  DotsThreeIcon,
  EyeIcon,
  EyeSlashIcon,
  PencilSimpleIcon,
  PlayIcon,
  StarIcon,
  StopIcon,
  TextAlignLeftIcon,
  TextboxIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import {
  Button,
  IconButton,
  Input,
  Menu,
  type MenuItem,
  type Renderable,
  Table,
  type TableColumn,
} from "@zovaris/sephiro";
import { useEffect, useState } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { type CatalogRow, PERSONAL } from "@/features/desktop/catalog";
import {
  isActiveState,
  latestExecution,
} from "@/features/executions/execution";
import type { CustomCommand } from "@/lib/types";

function useRun(row: CatalogRow) {
  const execution = useStore((state) =>
    latestExecution(state.executions, row.projectId, row.command.id),
  );
  const pending = useStore(
    (state) => state.pendingCommandId === row.command.id,
  );
  return {
    execution,
    active: execution ? isActiveState(execution.state) : false,
    pending,
  };
}

function Favorite({ row }: { row: CatalogRow }) {
  const { t } = useI18n();
  const setCommandFlag = useStore((state) => state.setCommandFlag);
  const saveCustomCommand = useStore((state) => state.saveCustomCommand);
  const label = t(row.favorite ? "favoriteOn" : "favoriteOff");
  return (
    <IconButton
      size="sm"
      density="compact"
      variant="ghost"
      className="pulso-favorite"
      data-on={row.favorite || undefined}
      icon={<StarIcon size={14} weight={row.favorite ? "fill" : "regular"} />}
      label={`${label} · ${row.command.label}`}
      title={label}
      aria-pressed={row.favorite}
      onClick={() => {
        if (row.custom)
          void saveCustomCommand({ ...row.custom, favorite: !row.favorite });
        else
          void setCommandFlag(row.projectId, row.command.id, {
            favorite: !row.favorite,
          });
      }}
    />
  );
}

function Name({ row }: { row: CatalogRow }) {
  const { t } = useI18n();
  const { execution, active } = useRun(row);
  const state =
    execution && (active || execution.state === "failed")
      ? execution.state
      : null;
  return (
    <span className="pulso-command-name" data-hidden={row.hidden || undefined}>
      <span className="truncate" title={row.command.label}>
        {row.command.label}
      </span>
      {state ? (
        <span
          className="pulso-dot"
          data-s={state}
          title={t(`state${state[0].toUpperCase()}${state.slice(1)}`)}
        />
      ) : null}
      {row.hidden ? (
        <EyeSlashIcon
          size={13}
          className="flex-none text-faint"
          aria-label={t("hiddenInMenubar")}
        />
      ) : null}
    </span>
  );
}

function Actions({
  row,
  onEdit,
  onRemove,
}: {
  row: CatalogRow;
  onEdit: (command: CustomCommand) => void;
  onRemove: (command: CustomCommand) => void;
}) {
  const { t } = useI18n();
  const { execution, active, pending } = useRun(row);
  const settling =
    execution?.state === "starting" || execution?.state === "stopping";
  const argsFor = useStore((state) => state.argsFor);
  const items: MenuItem[] = [
    ...(execution
      ? [
          {
            value: "logs",
            label: t("seeLogs"),
            icon: <TextAlignLeftIcon size={15} />,
          },
        ]
      : []),
    ...(row.custom
      ? []
      : [
          {
            value: "args",
            label: t("runWithArgs"),
            icon: <TextboxIcon size={15} />,
            disabled: active,
          },
        ]),
    ...(row.projectId === PERSONAL
      ? []
      : [
          {
            value: "hide",
            label: t(row.hidden ? "showInPopover" : "hideInPopover"),
            icon: row.hidden ? (
              <EyeIcon size={15} />
            ) : (
              <EyeSlashIcon size={15} />
            ),
          },
        ]),
    ...(row.custom
      ? [
          { separator: true },
          {
            value: "edit",
            label: t("editCommand"),
            icon: <PencilSimpleIcon size={15} />,
            disabled: active,
          },
          {
            value: "delete",
            label: t("deleteCommand"),
            icon: <TrashIcon size={15} />,
            danger: true,
            disabled: active,
          },
        ]
      : []),
  ];

  const choose = (value: string) => {
    const state = useStore.getState();
    if (value === "logs" && execution) {
      state.select(execution.id);
      state.setSection("logs");
    } else if (value === "args")
      state.setArgsFor(argsFor === row.key ? null : row.key);
    else if (value === "hide")
      void state.setCommandFlag(row.projectId, row.command.id, {
        hidden: !row.hidden,
      });
    else if (value === "edit" && row.custom) onEdit(row.custom);
    else if (value === "delete" && row.custom) onRemove(row.custom);
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        size="sm"
        variant={active ? "secondary" : "quiet"}
        motion="none"
        className="pulso-run-button"
        disabled={pending || settling}
        onClick={() => {
          const state = useStore.getState();
          if (active && execution) {
            if (state.confirmStop) state.askStop(execution.id);
            else void state.stopExecution(execution.id);
          } else void state.startCommand(row.projectId, row.command.id);
        }}
      >
        {active ? (
          <StopIcon size={11} weight="fill" />
        ) : (
          <PlayIcon size={11} weight="fill" />
        )}
        {t(
          execution?.state === "stopping"
            ? "stateStopping"
            : active
              ? "stopCommand"
              : "runCommand",
        )}
      </Button>
      <Menu
        label={`${t("moreActions")} · ${row.command.label}`}
        align="end"
        trigger={
          <IconButton
            size="sm"
            variant="ghost"
            icon={<DotsThreeIcon size={16} weight="bold" />}
            label={`${t("moreActions")} · ${row.command.label}`}
            title={t("moreActions")}
          />
        }
        items={items}
        onSelect={choose}
      />
    </div>
  );
}

function ArgumentsForm({ row }: { row: CatalogRow }) {
  const { t } = useI18n();
  const setArgsFor = useStore((state) => state.setArgsFor);
  const startCommand = useStore((state) => state.startCommand);
  const [draft, setDraft] = useState("");
  return (
    <form
      className="pulso-args-form"
      onSubmit={(event) => {
        event.preventDefault();
        void startCommand(
          row.projectId,
          row.command.id,
          draft.split(/\s+/).filter(Boolean),
        );
        setArgsFor(null);
      }}
    >
      <label htmlFor="command-args" className="flex-none text-xs">
        <span className="font-medium">{row.command.label}</span>{" "}
        <span className="text-faint">· {t("runWithArgs")}</span>
      </label>
      <Input
        id="command-args"
        size="sm"
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={t("argumentsPlaceholder")}
        className="min-w-0 flex-1 font-mono"
      />
      <Button size="sm" variant="primary" type="submit">
        {t("runCommand")}
      </Button>
      <Button
        size="sm"
        variant="quiet"
        type="button"
        onClick={() => setArgsFor(null)}
      >
        {t("cancel")}
      </Button>
    </form>
  );
}

/**
 * One command per line, in the same shape wherever commands are listed: the
 * star, the name and its state, what it runs, where it came from, and Run or
 * Stop at a fixed width. Everything less frequent waits behind ⋯.
 */
export function CommandTable({
  rows,
  showProject,
  empty,
  onEdit,
  onRemove,
}: {
  rows: CatalogRow[];
  showProject: boolean;
  empty: Renderable;
  onEdit: (command: CustomCommand) => void;
  onRemove: (command: CustomCommand) => void;
}) {
  const { t } = useI18n();
  const argsFor = useStore((state) => state.argsFor);
  const setArgsFor = useStore((state) => state.setArgsFor);
  const argsRow = rows.find((row) => row.key === argsFor);
  useEffect(() => {
    if (argsFor !== null && !argsRow) setArgsFor(null);
  }, [argsFor, argsRow, setArgsFor]);

  const columns: TableColumn<CatalogRow>[] = [
    {
      key: "favorite",
      label: <StarIcon size={13} aria-label={t("favorite")} />,
      width: "36px",
      render: (row) => <Favorite row={row} />,
    },
    {
      key: "name",
      label: t("columnName"),
      width: showProject ? "22%" : "28%",
      sortable: true,
      sortValue: (row) => row.command.label.toLowerCase(),
      render: (row) => <Name row={row} />,
    },
    {
      key: "invocation",
      label: t("columnCommand"),
      render: (row) => (
        <span
          className="block truncate font-mono text-xs text-faint"
          title={row.invocation}
        >
          {row.invocation}
        </span>
      ),
    },
    ...(showProject
      ? [
          {
            key: "project",
            label: t("columnProject"),
            width: "16%",
            sortable: true,
            sortValue: (row: CatalogRow) => row.projectName.toLowerCase(),
            render: (row: CatalogRow) => (
              <span className="block truncate text-xs" title={row.projectName}>
                {row.projectName}
              </span>
            ),
          },
        ]
      : []),
    {
      key: "origin",
      label: t("columnOrigin"),
      width: "120px",
      render: (row) => (
        <span className="block truncate text-xs text-faint">
          {row.origin ?? t("customOrigin")}
        </span>
      ),
    },
    {
      key: "actions",
      label: <span className="sr-only">{t("moreActions")}</span>,
      align: "end",
      width: "150px",
      render: (row) => (
        <Actions row={row} onEdit={onEdit} onRemove={onRemove} />
      ),
    },
  ];

  return (
    <>
      {argsRow ? <ArgumentsForm key={argsRow.key} row={argsRow} /> : null}
      <Table
        columns={columns}
        rows={rows}
        rowKey="key"
        density="compact"
        stickyHeader
        emptyMessage={empty}
        className="pulso-command-table"
      />
    </>
  );
}
