import { useState, useCallback, useRef, useEffect } from "react";
import { CodeEditor } from "./CodeEditor";
import { EditorTabs } from "./EditorTabs";
import { WorkspaceTreeView } from "./WorkspaceTreeView";
import { ChangesLogPanel } from "./ChangesLogPanel";
import { GitPanel } from "./GitPanel";
import { PageHeader } from "./ui/PageHeader";
import {
  fetchRepoConfig,
  fetchWorkspaceFile,
  saveWorkspaceFile,
  uploadWorkspaceFile,
} from "../api";
import type { RepoConfig } from "../types";
import { DownloadIcon } from "../Icons";
import { useT } from "../i18n/useT";
import i18n from "../i18n";

interface OpenTab {
  id: string;
  filePath: string;
  content: string;
  originalContent: string;
  language: string;
  isDirty: boolean;
}

interface WorkspacePageProps {
  workspaceId: number;
  workspaceName?: string;
  workspaceSelector?: React.ReactNode;
}

function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "ts":
      return "typescript";
    case "tsx":
      return "tsx";
    case "js":
      return "javascript";
    case "jsx":
      return "jsx";
    case "css":
      return "css";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "html":
      return "html";
    case "py":
      return "python";
    default:
      return "plaintext";
  }
}

export function WorkspacePage({
  workspaceId,
  workspaceName,
  workspaceSelector,
}: WorkspacePageProps): JSX.Element {
  const t = useT();
  const [repoConfig, setRepoConfig] = useState<RepoConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [gitPanelOpen, setGitPanelOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTabs([]);
    setActiveTabId("");
    setGitPanelOpen(false);
    setLoading(true);
    void loadRepoConfig(workspaceId);
  }, [workspaceId]);

  async function loadRepoConfig(targetWorkspaceId: number) {
    if (!targetWorkspaceId || targetWorkspaceId <= 0) {
      setRepoConfig(null);
      setLoading(false);
      return;
    }
    try {
      const config = await fetchRepoConfig(targetWorkspaceId);
      setRepoConfig(config);
    } catch {
      setRepoConfig(null);
    } finally {
      setLoading(false);
    }
  }

  const isConnected = repoConfig?.repoStatus === "connected";

  const openFile = useCallback(
    async (filePath: string) => {
      // Check if already open
      const existing = tabs.find((t) => t.filePath === filePath);
      if (existing) {
        setActiveTabId(existing.id);
        return;
      }

      try {
        const result = await fetchWorkspaceFile(workspaceId, filePath);
        const newTab: OpenTab = {
          id: `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          filePath,
          content: result.content,
          originalContent: result.content,
          language: detectLanguage(filePath),
          isDirty: false,
        };
        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(newTab.id);
      } catch (err) {
        console.error("Error opening file:", err);
      }
    },
    [tabs, workspaceId],
  );

  const handleTabSelect = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  const handleTabClose = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (tab?.isDirty) {
        if (!confirm(i18n.t("workspace.unsavedChanges"))) {
          return;
        }
      }
      setTabs((prev) => prev.filter((t) => t.id !== tabId));
      if (activeTabId === tabId) {
        const remaining = tabs.filter((t) => t.id !== tabId);
        setActiveTabId(remaining.length > 0 ? remaining[remaining.length - 1].id : "");
      }
    },
    [tabs, activeTabId, workspaceId],
  );

  const handleContentChange = useCallback(
    (content: string) => {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId ? { ...t, content, isDirty: content !== t.originalContent } : t,
        ),
      );
    },
    [activeTabId],
  );

  const handleSave = useCallback(
    async (content: string) => {
      const tab = tabs.find((t) => t.id === activeTabId);
      if (!tab) return;
      setSaving(true);
      try {
        await saveWorkspaceFile(workspaceId, tab.filePath, content);
        setTabs((prev) =>
          prev.map((t) =>
            t.id === activeTabId ? { ...t, content, originalContent: content, isDirty: false } : t,
          ),
        );
      } catch (err) {
        console.error("Error saving file:", err);
      } finally {
        setSaving(false);
      }
    },
    [tabs, activeTabId, workspaceId],
  );

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        await uploadWorkspaceFile(file, undefined, workspaceId);
      } catch (err) {
        console.error("Error uploading file:", err);
      }
      e.target.value = "";
    },
    [workspaceId],
  );

  const handleDownload = useCallback(() => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;
    const blob = new Blob([tab.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = tab.filePath.split("/").pop() || "file.txt";
    a.click();
    URL.revokeObjectURL(url);
  }, [tabs, activeTabId]);

  const handleFileClick = useCallback(
    (filePath: string) => {
      openFile(filePath);
    },
    [openFile],
  );

  // Handle keyboard save shortcut at page level
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        const tab = tabs.find((t) => t.id === activeTabId);
        if (tab) {
          handleSave(tab.content);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tabs, activeTabId, handleSave]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted-400">{t("workspace.loading")}</p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-surface-400/50 border border-white/5 flex items-center justify-center mx-auto mb-4">
            <svg
              width="32"
              height="32"
              fill="currentColor"
              className="text-muted-500"
              viewBox="0 0 256 256"
            >
              <path d="M216,72H131.31L104,44.69A15.86,15.86,0,0,0,92.69,40H40A16,16,0,0,0,24,56V200.62A15.4,15.4,0,0,0,39.38,216H216.89A15.13,15.13,0,0,0,232,200.89V88A16,16,0,0,0,216,72ZM40,56H92.69l16,16H40ZM216,200H40V88H216Z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">{t("workspace.notConfigured")}</h2>
          <p className="text-sm text-muted-400 mb-4">
            {t("workspace.notConfigured_desc")}
          </p>
        </div>
      </div>
    );
  }

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeader
        title={t("workspace.title")}
        subtitle={t("workspace.subtitle", { name: workspaceName ?? t("workspace.defaultName") })}
        actions={workspaceSelector}
      />
      {/* Action bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-surface-400/20">
        <h2 className="text-sm font-medium text-muted-300 mr-auto">
          {workspaceName ?? t("workspace.title")}
        </h2>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="btn-secondary text-xs flex items-center gap-1.5"
          aria-label={t("workspace.uploadFile")}
        >
          <svg width="14" height="14" fill="currentColor" viewBox="0 0 256 256">
            <path d="M240,136v64a16,16,0,0,1-16,16H32a16,16,0,0,1-16-16V136a8,8,0,0,1,16,0v64H224V136a8,8,0,0,1,16,0ZM85.66,77.66,120,43.31V128a8,8,0,0,0,16,0V43.31l34.34,34.35a8,8,0,0,0,11.32-11.32l-48-48a8,8,0,0,0-11.32,0l-48,48A8,8,0,0,0,85.66,77.66Z" />
          </svg>
          {t("action.upload")}
        </button>
        <button
          onClick={() => handleSave(activeTab?.content ?? "")}
          disabled={!activeTab?.isDirty || saving}
          className="btn-primary text-xs flex items-center gap-1.5"
          aria-label={t("workspace.saveFile")}
        >
          {saving ? t("action.saving") : t("action.save")}
        </button>
        <button
          onClick={handleDownload}
          disabled={!activeTab}
          className="btn-secondary text-xs flex items-center gap-1.5"
          aria-label={t("workspace.downloadFile")}
        >
          <DownloadIcon size={14} />
          {t("action.download")}
        </button>
        <button
          onClick={() => setGitPanelOpen((v) => !v)}
          className={`text-xs px-2 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${gitPanelOpen ? "bg-accent text-white" : "bg-surface-400/50 text-muted-300 hover:bg-surface-400"}`}
          aria-label={gitPanelOpen ? t("workspace.closeGit") : t("workspace.openGit")}
        >
          <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
            <path d="M15.698 7.287L8.712.302a1.03 1.03 0 00-1.457 0l-1.45 1.45 1.84 1.84a1.223 1.223 0 011.55 1.56l1.773 1.774a1.224 1.224 0 011.267 2.025 1.226 1.226 0 01-2.002-1.334L8.49 5.873v4.46a1.226 1.226 0 11-.956.019V5.764a1.226 1.226 0 01-.666-1.608L5.058 2.346l-4.756 4.756a1.03 1.03 0 000 1.457l6.986 6.986a1.03 1.03 0 001.457 0l6.953-6.953a1.031 1.031 0 000-1.305z" />
          </svg>
          Git
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          onChange={handleUpload}
          aria-label={t("workspace.selectUpload")}
        />
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — tree (full height) */}
        <aside
          className="w-[280px] shrink-0 border-r border-white/5 overflow-y-auto bg-surface-500/30 p-2"
          aria-label={t("workspace.explorer")}
        >
          <WorkspaceTreeView
            workspaceId={workspaceId}
            taskId={0}
            onFileSelect={openFile}
            onAddReference={() => {}}
            repoConfigured={isConnected}
          />
        </aside>

        {/* Right column — editor + changes log stacked */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <EditorTabs
            tabs={tabs.map((t) => ({ id: t.id, filePath: t.filePath, isDirty: t.isDirty }))}
            activeTabId={activeTabId}
            onTabSelect={handleTabSelect}
            onTabClose={handleTabClose}
          />
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden">
              {activeTab ? (
                <CodeEditor
                  content={activeTab.content}
                  language={activeTab.language}
                  onChange={handleContentChange}
                  onSave={handleSave}
                  readOnly={false}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center bg-surface-500/20">
                  <p className="text-sm text-muted-500">
                    {t("workspace.selectFile")}
                  </p>
                </div>
              )}
              {/* Changes log below editor */}
              <ChangesLogPanel workspaceId={workspaceId} onFileClick={handleFileClick} />
            </div>

            {/* Git panel */}
            {gitPanelOpen && (
              <aside className="w-[300px] shrink-0 overflow-y-auto" aria-label={t("workspace.gitPanel")}>
                <GitPanel workspaceId={workspaceId} onFileClick={handleFileClick} />
              </aside>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
