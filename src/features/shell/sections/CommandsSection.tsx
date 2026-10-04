import { MagnifyingGlassIcon, PlusIcon } from "@phosphor-icons/react";
import {
  Button,
  EmptyState,
  Input,
  SegmentedControl,
  Select,
} from "@zovaris/sephiro";
import { useMemo, useState } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import {
  type CatalogKind,
  catalogRows,
  filterCatalog,
  kindCounts,
  PERSONAL,
} from "@/features/desktop/catalog";
import { useCommandEditor } from "@/features/shell/components/CommandEditor";
import { CommandTable } from "@/features/shell/components/CommandTable";
import { useGroupEditor } from "@/features/shell/components/GroupEditor";
import { GroupList } from "@/features/shell/components/GroupList";

const KINDS: CatalogKind[] = ["all", "detected", "custom", "favorites"];
const ALL_PROJECTS = "all";

/**
 * One catalog of everything Pulso can run. Detected and custom commands sit
 * side by side, told apart by their source; only the custom ones can be edited.
 */
export function CommandsSection() {
  const { t } = useI18n();
  const projects = useStore((state) => state.projects);
  const scans = useStore((state) => state.scans);
  const customs = useStore((state) => state.customCommands);
  const editor = useCommandEditor();
  const groups = useGroupEditor();
  const commandGroups = useStore((state) => state.commandGroups);
  const [kind, setKind] = useState<CatalogKind>("all");
  const [scope, setScope] = useState(ALL_PROJECTS);
  const [text, setText] = useState("");

  const rows = useMemo(
    () => catalogRows(projects, scans, customs, t("personalCommands")),
    [projects, scans, customs, t],
  );
  const projectId = scope === ALL_PROJECTS ? null : Number(scope);
  const scoped = useMemo(
    () => filterCatalog(rows, { kind: "all", projectId, text: "" }),
    [rows, projectId],
  );
  const counts = kindCounts(scoped, KINDS);
  const shown = filterCatalog(rows, { kind, projectId, text });
  const filtered =
    kind !== "all" || scope !== ALL_PROJECTS || text.trim() !== "";
  const clear = () => {
    setKind("all");
    setScope(ALL_PROJECTS);
    setText("");
  };

  return (
    <div className="pulso-pane flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex flex-none items-start gap-4 px-6 pt-5 pb-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-[16px] font-semibold tracking-[-0.015em]">
            {t("sectionCommands")}
          </h1>
          <p className="mt-1 text-[12px] text-mist">{t("catalogLede")}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={groups.create}>
          <PlusIcon size={13} weight="bold" />
          {t("newGroup")}
        </Button>
        <Button
          size="sm"
          variant="primary"
          onClick={() =>
            editor.create(projectId === PERSONAL ? null : projectId)
          }
        >
          <PlusIcon size={13} weight="bold" />
          {t("newCommand")}
        </Button>
      </header>

      {commandGroups.length ? (
        <section className="pulso-groups" aria-labelledby="groups-title">
          <h2 id="groups-title" className="pulso-block-title">
            {t("groupsTitle")}
          </h2>
          <GroupList
            groups={commandGroups}
            rows={rows}
            onEdit={groups.edit}
            onRemove={groups.remove}
          />
        </section>
      ) : null}

      <div className="pulso-filter-bar">
        <SegmentedControl
          size="sm"
          ariaLabel={t("commandFilters")}
          value={kind}
          onValueChange={(value) => setKind(value as CatalogKind)}
          options={KINDS.map((entry) => ({
            value: entry,
            label: (
              <>
                {t(`kind${entry[0].toUpperCase()}${entry.slice(1)}`)}
                <span className="pulso-count">{counts[entry]}</span>
              </>
            ),
          }))}
        />
        <Select
          size="sm"
          ariaLabel={t("catalogScope")}
          value={scope}
          onValueChange={setScope}
          options={[
            { value: ALL_PROJECTS, label: t("catalogAllProjects") },
            ...projects.map((project) => ({
              value: String(project.id),
              label: project.name,
            })),
            { value: String(PERSONAL), label: t("personalCommands") },
          ]}
        />
        <label className="pulso-search ml-auto">
          <MagnifyingGlassIcon size={13} aria-hidden />
          <Input
            size="sm"
            aria-label={t("searchCommands")}
            placeholder={t("searchCommands")}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-5 pb-4">
        {rows.length === 0 ? (
          <EmptyState
            title={t("noCustomCommands")}
            description={t("customCommandsEmpty")}
            action={
              <Button
                size="sm"
                variant="primary"
                onClick={() => editor.create()}
              >
                {t("newCommand")}
              </Button>
            }
          />
        ) : (
          <CommandTable
            rows={shown}
            showProject={projectId === null}
            onEdit={editor.edit}
            onRemove={editor.remove}
            empty={
              <EmptyState
                compact
                title={t("nothingInFilter")}
                action={
                  filtered ? (
                    <Button size="sm" variant="quiet" onClick={clear}>
                      {t("clearSearch")}
                    </Button>
                  ) : undefined
                }
              />
            }
          />
        )}
      </div>

      <footer className="pulso-section-footer">
        {t("commandCount", { count: shown.length })}
      </footer>
      {editor.dialogs}
      {groups.dialogs}
    </div>
  );
}
