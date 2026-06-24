import { useT } from "../i18n/useT";

interface EditorTab {
  id: string;
  filePath: string;
  isDirty: boolean;
}

interface EditorTabsProps {
  tabs: EditorTab[];
  activeTabId: string;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
}

export function EditorTabs({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
}: EditorTabsProps): JSX.Element {
  const t = useT();
  if (tabs.length === 0) {
    return <div className="h-9 border-b border-white/5 bg-surface-400/30" />;
  }

  return (
    <div
      className="flex items-center gap-0 h-9 border-b border-white/5 bg-surface-400/30 overflow-x-auto"
      role="tablist"
      aria-label={t("editor.label")}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const fileName = tab.filePath.split("/").pop() || tab.filePath;
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            className={`flex items-center gap-1.5 px-3 h-full text-xs font-mono cursor-pointer border-r border-white/5 shrink-0 transition-colors ${
              isActive
                ? "bg-surface-200 text-white border-b-2 border-b-accent"
                : "text-muted-400 hover:text-muted-300 hover:bg-white/5"
            }`}
            onClick={() => onTabSelect(tab.id)}
            aria-label={`${fileName}${tab.isDirty ? ` ${t("editor.unsavedIndicator")}` : ""}`}
          >
            {/* Dirty indicator */}
            {tab.isDirty && (
              <span
                className="w-2 h-2 rounded-full bg-warning shrink-0"
                aria-label={t("editor.changesUnsaved")}
              />
            )}
            <span className="truncate max-w-[120px]">{fileName}</span>
            {/* Close button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
              className="ml-1 w-4 h-4 flex items-center justify-center rounded hover:bg-white/10 text-muted-500 hover:text-white transition-colors"
              aria-label={t("editor.closeFile", { name: fileName })}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
