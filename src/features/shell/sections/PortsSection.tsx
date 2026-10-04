import {
  ArrowClockwiseIcon,
  GlobeIcon,
  MagnifyingGlassIcon,
  StopIcon,
} from "@phosphor-icons/react";
import {
  Alert,
  Button,
  IconButton,
  EmptyState,
  Input,
  SegmentedControl,
  Table,
  type TableColumn,
} from "@zovaris/sephiro";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { isTauri } from "@/lib/tauri";
import type { ListeningPort } from "@/lib/types";
import { toBackendError } from "@/services/api/errors";
import {
  listListeningPorts,
  openListeningPort,
  stopPortProcess,
} from "@/services/api/ports";

type Origin = "all" | "pulso" | "external";
const ORIGINS: Origin[] = ["all", "pulso", "external"];

export function PortsSection() {
  const { t } = useI18n();
  const executions = useStore((state) => state.executions);
  const projects = useStore((state) => state.projects);
  const select = useStore((state) => state.select);
  const setSection = useStore((state) => state.setSection);
  const [ports, setPorts] = useState<ListeningPort[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<ListeningPort | null>(null);
  const [busy, setBusy] = useState(false);
  const [stopping, setStopping] = useState<ListeningPort | null>(null);
  const request = useRef(0);
  const scanning = useRef(false);
  const acting = useRef(false);
  const mounted = useRef(false);

  const refresh = useCallback(async () => {
    if (scanning.current || acting.current) return;
    scanning.current = true;
    const id = ++request.current;
    setLoading(true);
    try {
      const snapshot = await listListeningPorts();
      if (!mounted.current || id !== request.current) return;
      setPorts(snapshot);
      setLoaded(true);
      setError(null);
      setStopping((previous) =>
        previous &&
        snapshot.some(
          (port) =>
            port.pid === previous.pid && port.startedAt === previous.startedAt,
        )
          ? previous
          : null,
      );
    } catch (cause) {
      if (mounted.current && id === request.current)
        setError(toBackendError(cause).message);
    } finally {
      if (id === request.current) {
        scanning.current = false;
        if (mounted.current) setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const visibleRefresh = async () => {
      if (document.visibilityState !== "visible") return;
      if (isTauri()) {
        try {
          const { getCurrentWindow } = await import("@tauri-apps/api/window");
          const window = getCurrentWindow();
          if (!(await window.isVisible()) || (await window.isMinimized()))
            return;
        } catch {
          return;
        }
      }
      if (mounted.current) void refresh();
    };
    const checkVisibility = () => {
      void visibleRefresh();
    };
    checkVisibility();
    const timer = window.setInterval(checkVisibility, 3000);
    document.addEventListener("visibilitychange", checkVisibility);
    return () => {
      mounted.current = false;
      request.current += 1;
      scanning.current = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", checkVisibility);
    };
  }, [refresh]);

  const stop = async (port: ListeningPort) => {
    if (acting.current) return;
    acting.current = true;
    request.current += 1;
    scanning.current = false;
    setLoading(false);
    setBusy(true);
    setConfirming(null);
    setActionError(null);
    try {
      await stopPortProcess(port);
      if (mounted.current) setStopping(port);
    } catch (cause) {
      if (mounted.current) setActionError(toBackendError(cause).message);
    } finally {
      acting.current = false;
      if (mounted.current) {
        setBusy(false);
        void refresh();
      }
    }
  };

  const nameOf = (port: ListeningPort) => {
    const execution = executions.find((entry) => entry.id === port.executionId);
    if (!execution)
      return port.executionId === null ? t("portExternal") : t("portManaged");
    const project = projects.find((entry) => entry.id === execution.projectId);
    return `${project?.name ?? t("personalCommands")} · ${execution.label}`;
  };
  const [origin, setOrigin] = useState<Origin>("all");
  const search = query.trim().toLocaleLowerCase();
  const inOrigin = (port: ListeningPort, which: Origin) =>
    which === "all" || (which === "pulso") === (port.executionId !== null);
  const filtered = ports.filter(
    (port) =>
      inOrigin(port, origin) &&
      `${port.port} ${port.pid} ${port.address} ${port.process} ${nameOf(port)}`
        .toLocaleLowerCase()
        .includes(search),
  );
  const native = isTauri();
  const displayedError = error ?? actionError;
  const emptyNote = t(
    !native
      ? "portsDesktopOnly"
      : !loaded && loading
        ? "portsLoading"
        : !loaded && error
          ? "portsUnavailable"
          : search || origin !== "all"
            ? "noMatchingPorts"
            : "noListeningPorts",
  );

  const columns: TableColumn<ListeningPort>[] = [
    {
      key: "port",
      label: t("columnPort"),
      width: "76px",
      sortable: true,
      sortValue: (port) => port.port,
      render: (port) => (
        <span className="font-mono text-accent-strong tabular-nums">
          :{port.port}
        </span>
      ),
    },
    {
      key: "address",
      label: t("columnAddress"),
      width: "22%",
      render: (port) => (
        <span
          className="block truncate font-mono text-xs text-faint"
          title={port.address}
        >
          {port.address}
        </span>
      ),
    },
    {
      key: "process",
      label: t("columnProcess"),
      sortable: true,
      sortValue: (port) => port.process.toLowerCase(),
      render: (port) => (
        <span className="block truncate font-medium" title={port.process}>
          {port.process}
        </span>
      ),
    },
    {
      key: "pid",
      label: t("columnPid"),
      width: "72px",
      align: "end",
      render: (port) => (
        <span className="font-mono text-xs text-mist tabular-nums">
          {port.pid}
        </span>
      ),
    },
    {
      key: "origin",
      label: t("columnOrigin"),
      width: "22%",
      render: (port) =>
        port.executionId === null ? (
          <span className="text-xs text-faint">{t("portExternal")}</span>
        ) : (
          <button
            type="button"
            className="pulso-cell-link"
            onClick={() => {
              select(port.executionId);
              setSection("processes");
            }}
          >
            <span className="truncate">{nameOf(port)}</span>
          </button>
        ),
    },
    {
      key: "actions",
      label: <span className="sr-only">{t("portActions")}</span>,
      align: "end",
      width: "84px",
      render: (port) => (
        <div className="flex justify-end gap-1">
          <IconButton
            size="sm"
            variant="ghost"
            icon={<GlobeIcon size={15} />}
            label={t("openPortHttp")}
            title={`${t("openPortHttp")} · ${t("openPortHttpHint")}`}
            disabled={busy}
            onClick={() => {
              void openListeningPort(port).catch((cause) => {
                if (mounted.current)
                  setActionError(toBackendError(cause).message);
              });
            }}
          />
          <IconButton
            size="sm"
            variant="ghost"
            className="pulso-control-danger"
            icon={<StopIcon size={13} weight="fill" />}
            label={t("stopPortProcess")}
            title={port.canStop ? t("stopPortProcess") : t("portProtected")}
            disabled={busy || !port.canStop}
            onClick={() => setConfirming(port)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex flex-none items-start gap-4 px-6 pt-5 pb-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-[16px] font-semibold tracking-[-0.015em]">
            {t("sectionPorts")}
          </h1>
          <p className="mt-1 text-[12px] text-mist">{t("portsLede")}</p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={loading || busy || !native}
          onClick={() => void refresh()}
        >
          <ArrowClockwiseIcon size={13} />
          {t(loading ? "portsLoading" : "refreshPorts")}
        </Button>
      </header>

      <div className="pulso-filter-bar">
        <SegmentedControl
          size="sm"
          ariaLabel={t("columnOrigin")}
          value={origin}
          onValueChange={(value) => setOrigin(value as Origin)}
          options={ORIGINS.map((entry) => ({
            value: entry,
            label: (
              <>
                {t(`origin${entry[0].toUpperCase()}${entry.slice(1)}`)}
                <span className="pulso-count">
                  {ports.filter((port) => inOrigin(port, entry)).length}
                </span>
              </>
            ),
          }))}
        />
        <label className="pulso-search pulso-search--wide ml-auto">
          <MagnifyingGlassIcon size={13} aria-hidden />
          <Input
            size="sm"
            type="search"
            value={query}
            aria-label={t("searchPorts")}
            placeholder={t("searchPorts")}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      {displayedError ? (
        <Alert
          variant="danger"
          role="alert"
          dismissible
          onDismiss={() => {
            setError(null);
            setActionError(null);
          }}
          className="mx-5 mb-3"
        >
          {displayedError}
        </Alert>
      ) : null}
      {stopping ? (
        <p role="status" className="mx-6 mb-3 text-[12px] text-mist">
          {t("portStopRequested", {
            process: stopping.process,
            pid: stopping.pid,
          })}
        </p>
      ) : null}

      <div
        role="region"
        aria-label={t("listeningPorts")}
        tabIndex={0}
        className="pulso-pane min-h-0 flex-1 overflow-auto overscroll-contain px-5 pb-4"
      >
        {filtered.length === 0 ? (
          <EmptyState compact title={emptyNote} />
        ) : (
          <Table
            columns={columns}
            rows={filtered}
            getRowId={(port) => `${port.pid}:${port.startedAt}:${port.address}`}
            density="compact"
            stickyHeader
            className="pulso-command-table"
          />
        )}
      </div>

      <footer className="pulso-section-footer flex justify-between gap-4">
        <span className="min-w-0">{t("portsNote")}</span>
        {loaded && native ? (
          <span className="flex-none">
            {t("listeningCount", { count: ports.length })}
          </span>
        ) : null}
      </footer>
      {confirming ? (
        <ConfirmDialog
          title={t("confirmPortStopTitle")}
          body={t(
            confirming.executionId === null
              ? "confirmExternalPortStopBody"
              : "confirmManagedPortStopBody",
            {
              process: confirming.process,
              pid: confirming.pid,
              port: confirming.port,
            },
          )}
          confirmLabel={t("stopPortProcess")}
          cancelLabel={t("cancel")}
          onCancel={() => setConfirming(null)}
          onConfirm={() => void stop(confirming)}
        />
      ) : null}
    </div>
  );
}
