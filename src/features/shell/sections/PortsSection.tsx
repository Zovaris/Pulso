import { ArrowClockwiseIcon, GlobeIcon, StopIcon } from "@phosphor-icons/react";
import { Button, Input } from "@zovaris/sephiro";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/app/hooks/useI18n";
import { useStore } from "@/app/store";
import { Card, CardEmpty } from "@/components/shared/Card";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { isTauri } from "@/lib/tauri";
import type { ListeningPort } from "@/lib/types";
import { toBackendError } from "@/services/api/errors";
import {
  listListeningPorts,
  openListeningPort,
  stopPortProcess,
} from "@/services/api/ports";

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
        // A later poll, rather than a successful signal alone, proves release.
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
  const search = query.trim().toLocaleLowerCase();
  const filtered = ports.filter((port) =>
    `${port.port} ${port.pid} ${port.address} ${port.process} ${nameOf(port)}`
      .toLocaleLowerCase()
      .includes(search),
  );
  const native = isTauri();
  const displayedError = error ?? actionError;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3.5 overflow-hidden px-6 py-5">
      <header className="flex shrink-0 items-start justify-between gap-4">
        <div>
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
          <ArrowClockwiseIcon size={14} />
          {t(loading ? "portsLoading" : "refreshPorts")}
        </Button>
      </header>
      <Input
        className="shrink-0"
        type="search"
        value={query}
        aria-label={t("searchPorts")}
        placeholder={t("searchPorts")}
        onChange={(event) => setQuery(event.target.value)}
      />
      {displayedError ? (
        <div
          role="alert"
          className="flex shrink-0 items-center gap-3 rounded-lg border border-line px-3 py-2 text-[12px] text-alarm"
        >
          <span className="flex-1">{displayedError}</span>
          <Button
            size="sm"
            variant="quiet"
            onClick={() => {
              setError(null);
              setActionError(null);
            }}
          >
            {t("dismiss")}
          </Button>
        </div>
      ) : null}
      {stopping ? (
        <p role="status" className="shrink-0 text-[12px] text-mist">
          {t("portStopRequested", {
            process: stopping.process,
            pid: stopping.pid,
          })}
        </p>
      ) : null}
      <Card
        className="flex min-h-0 flex-1 flex-col [&>header]:shrink-0"
        title={t("listeningPorts")}
        meta={
          loaded && native
            ? t("listeningCount", { count: ports.length })
            : undefined
        }
      >
        {filtered.length === 0 ? (
          <CardEmpty
            note={t(
              !native
                ? "portsDesktopOnly"
                : !loaded && loading
                  ? "portsLoading"
                  : !loaded && error
                    ? "portsUnavailable"
                    : search
                      ? "noMatchingPorts"
                      : "noListeningPorts",
            )}
          />
        ) : (
          <div
            role="region"
            aria-label={t("listeningPorts")}
            tabIndex={0}
            className="pulso-pane min-h-0 flex-1 overflow-auto overscroll-contain"
          >
            <table className="w-full text-left text-[12px]">
              <thead className="sticky top-0 z-10 border-b border-hairline bg-panel text-[11px] text-faint">
                <tr>
                  {["port", "process", "pid", "portOrigin", "portActions"].map(
                    (key) => (
                      <th
                        key={key}
                        scope="col"
                        className="px-3.5 py-2 font-medium"
                      >
                        {t(key)}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((port) => (
                  <tr
                    key={`${port.pid}:${port.startedAt}:${port.address}`}
                    className="border-b border-hairline last:border-b-0"
                  >
                    <td className="px-3.5 py-3">
                      <span className="font-mono text-accent-strong">
                        :{port.port}
                      </span>
                      <span className="mt-1 block whitespace-nowrap font-mono text-[11px] text-faint">
                        {port.address}
                      </span>
                    </td>
                    <td className="px-3.5 py-3">{port.process}</td>
                    <td className="px-3.5 py-3 font-mono text-mist">
                      {port.pid}
                    </td>
                    <td className="px-3.5 py-3">
                      <span className="mb-1 block text-[10px] text-faint">
                        {t(
                          port.executionId === null
                            ? "portExternal"
                            : "portManaged",
                        )}
                      </span>
                      {port.executionId !== null ? (
                        <Button
                          size="sm"
                          variant="quiet"
                          onClick={() => {
                            select(port.executionId);
                            setSection("processes");
                          }}
                        >
                          {nameOf(port)}
                        </Button>
                      ) : null}
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="quiet"
                          title={t("openPortHttpHint")}
                          disabled={busy}
                          onClick={() => {
                            void openListeningPort(port).catch((cause) => {
                              if (mounted.current)
                                setActionError(toBackendError(cause).message);
                            });
                          }}
                        >
                          <GlobeIcon size={13} />
                          {t("openPortHttp")}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="pulso-control-danger"
                          disabled={busy || !port.canStop}
                          title={
                            port.canStop
                              ? t("stopPortProcess")
                              : t("portProtected")
                          }
                          onClick={() => setConfirming(port)}
                        >
                          <StopIcon size={12} />
                          {t("stopPortProcess")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="shrink-0 text-[11px] leading-5 text-faint">
        {t("portsNote")}
      </p>
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
