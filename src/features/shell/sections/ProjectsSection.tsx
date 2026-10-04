import {
  FolderSimplePlusIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from "@phosphor-icons/react";
import {
  Alert,
  Button,
  EmptyState,
  Input,
  SegmentedControl,
} from "@zovaris/sephiro";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { Orb } from "@/components/shared/Orb";
import {
  type CatalogKind,
  catalogRows,
  filterCatalog,
  kindCounts,
} from "@/features/desktop/catalog";
import { scanMessage } from "@/features/projects/scanMessage";
import { useAddProject } from "@/features/projects/useAddProject";
import { useCommandEditor } from "@/features/shell/components/CommandEditor";
import { CommandTable } from "@/features/shell/components/CommandTable";
import { EditorSplit } from "@/features/shell/components/EditorSplit";
import { ProjectInspector } from "@/features/shell/components/Inspector";

const KINDS: CatalogKind[] = ["all", "favorites", "custom", "hidden"];

export function ProjectsSection() {
  const { t } = useI18n();
  const projects = useStore((state) => state.projects);
  const scans = useStore((state) => state.scans);
  const customs = useStore((state) => state.customCommands);
  const selectedProjectId = useStore((state) => state.selectedProjectId);
  const error = useStore((state) => state.projectError);
  const dismissProjectError = useStore((state) => state.dismissProjectError);
  const setArgsFor = useStore((state) => state.setArgsFor);
  const addProject = useAddProject();
  const editor = useCommandEditor();
  const [kind, setKind] = useState<CatalogKind>("all");
  const [text, setText] = useState("");
  const project =
    projects.find((entry) => entry.id === selectedProjectId) ?? projects[0];
  const scan = project ? scans[String(project.id)] : undefined;

  useEffect(() => {
    setArgsFor(null);
    setKind("all");
    setText("");
  }, [project?.id, setArgsFor]);

  const rows = useMemo(
    () =>
      project
        ? catalogRows([project], scans, customs, t("personalCommands")).filter(
            (row) => row.projectId === project.id,
          )
        : [],
    [project, scans, customs, t],
  );
  const counts = kindCounts(rows, KINDS);
  const shown = filterCatalog(rows, { kind, projectId: null, text });
  const message = scan ? scanMessage(scan) : null;

  if (!project) {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center p-6">
        <EmptyState
          icon={<FolderSimplePlusIcon size={28} />}
          title={t("noProjects")}
          description={t("emptyProjects")}
          action={
            <Button
              size="sm"
              variant="primary"
              onClick={() => void addProject()}
            >
              {t("addProject")}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <>
      <section className="pulso-pane flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex flex-none items-start gap-4 px-6 pt-5 pb-4">
          <div className="min-w-0 flex-1">
            <h1
              className="truncate text-[16px] font-semibold tracking-[-0.015em]"
              title={project.name}
            >
              {project.name}
            </h1>
            <p
              className="mt-1 truncate font-mono text-[11.5px] text-faint"
              title={project.path}
            >
              {project.path}
            </p>
          </div>
          <EditorSplit projectId={project.id} />
        </header>

        {project.availability === "available" ? (
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
            <Button
              size="sm"
              variant="quiet"
              onClick={() => editor.create(project.id)}
            >
              <PlusIcon size={13} weight="bold" />
              {t("newCommand")}
            </Button>
          </div>
        ) : null}

        {error ? (
          <Alert
            variant="danger"
            dismissible
            onDismiss={dismissProjectError}
            className="mx-5 mb-3"
          >
            {error.message}
          </Alert>
        ) : null}

        <div className="min-h-0 flex-1 overflow-auto px-5 pb-4">
          {project.availability !== "available" ? (
            <EmptyState
              title={t("projectMissing")}
              description={project.path}
            />
          ) : !scan ? (
            <EmptyState
              compact
              icon={<Orb state="searching" size={64} />}
              title={t("readingManifest")}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title={message ? t(message.key) : t("noCommands")}
              description={message?.detail}
              compact
            />
          ) : (
            <CommandTable
              rows={shown}
              showProject={false}
              onEdit={editor.edit}
              onRemove={editor.remove}
              empty={
                <EmptyState
                  compact
                  title={t("nothingInFilter")}
                  action={
                    <Button
                      size="sm"
                      variant="quiet"
                      onClick={() => {
                        setKind("all");
                        setText("");
                      }}
                    >
                      {t("clearSearch")}
                    </Button>
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
      </section>
      <ProjectInspector project={project} />
    </>
  );
}
