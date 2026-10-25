"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  ensurePreview,
  fetchFile,
  saveWorkspaceFile,
  createWorkspaceFile,
  createWorkspaceFolder,
  renameWorkspacePath,
  deleteWorkspacePath,
} from "@/lib/api";
import { useTheme } from "@/lib/theme/theme-context";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import {
  Code,
  Monitor,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FolderPlus,
  FilePlus,
  FolderDown,
  File,
  FileCode,
  FileCode2,
  FileText,
  FileJson,
  Globe,
  RefreshCw,
  ExternalLink,
  Terminal as TerminalIcon,
  Loader2,
  Smartphone,
  Tablet,
  Laptop,
  Columns,
  FolderTree,
  PanelLeftClose,
  PanelLeftOpen,
  PanelBottomClose,
  Save,
  X,
  Edit2,
  Trash2,
  Copy,
  Check,
  Search,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  FolderArchive,
} from "lucide-react";
import { Terminal } from "@/components/terminal";
import { ImportRepoModal } from "@/components/import-repo-modal";
import { FileIcon } from "@/components/file-icon";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-[var(--muted-foreground)] text-sm">
      <Loader2 className="h-5 w-5 animate-spin mr-2 text-[var(--primary)]" />
      Chargement de l&apos;éditeur de code...
    </div>
  ),
});

export interface EditorTab {
  path: string;
  name: string;
  content: string;
  savedContent: string;
  isDirty: boolean;
}

interface FileNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileNode[];
}

function buildFileTree(paths: string[]): FileNode[] {
  const root: FileNode[] = [];

  for (const fullPath of paths) {
    const parts = fullPath.split("/").filter(Boolean);
    let current = root;

    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      let node = current.find((n) => n.name === part);
      if (!node) {
        node = {
          name: part,
          path: parts.slice(0, i + 1).join("/"),
          type: isFile ? "file" : "folder",
          children: isFile ? undefined : [],
        };
        current.push(node);
      }
      if (!isFile && node.children) current = node.children;
    });
  }

  const sort = (nodes: FileNode[]): FileNode[] =>
    nodes
      .sort((a, b) =>
        a.type === b.type
          ? a.name.localeCompare(b.name)
          : a.type === "folder"
            ? -1
            : 1,
      )
      .map((n) => (n.children ? { ...n, children: sort(n.children) } : n));

  return sort(root);
}

function getFileLanguage(path: string): string {
  if (path.endsWith(".tsx") || path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".jsx") || path.endsWith(".js") || path.endsWith(".mjs")) return "javascript";
  if (path.endsWith(".py")) return "python";
  if (path.endsWith(".css") || path.endsWith(".scss")) return "css";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".md") || path.endsWith(".mdx")) return "markdown";
  if (path.endsWith(".yaml") || path.endsWith(".yml")) return "yaml";
  if (path.endsWith(".sql")) return "sql";
  if (path.endsWith(".sh") || path.endsWith(".bash")) return "shell";
  if (path.endsWith(".rs")) return "rust";
  if (path.endsWith(".go")) return "go";
  if (path.endsWith(".java")) return "java";
  if (path.endsWith(".cpp") || path.endsWith(".c") || path.endsWith(".h")) return "cpp";
  return "plaintext";
}

function getFileLanguageLabel(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "tsx":
      return "TypeScript React";
    case "ts":
      return "TypeScript";
    case "jsx":
      return "JavaScript React";
    case "js":
    case "mjs":
      return "JavaScript";
    case "py":
      return "Python";
    case "css":
    case "scss":
      return "CSS Styles";
    case "json":
      return "JSON";
    case "html":
      return "HTML Document";
    case "md":
      return "Markdown";
    case "yaml":
    case "yml":
      return "YAML Config";
    case "sql":
      return "SQL Query";
    case "sh":
      return "Shell Script";
    default:
      return ext?.toUpperCase() || "Text";
  }
}

interface PreviewPanelProps {
  sessionId: string;
  previewUrl: string | null;
  filePaths: string[];
  providerId?: string;
  onPreviewUrl?: (url: string | null) => void;
  onRefreshFiles?: () => void;
}

export function PreviewPanel({
  sessionId,
  previewUrl,
  filePaths,
  providerId,
  onPreviewUrl,
  onRefreshFiles,
}: PreviewPanelProps) {
  const { resolvedIsDark } = useTheme();

  // Multi-Tab & Editor State
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<"code" | "demo" | "split">("code");
  const [showFileExplorer, setShowFileExplorer] = useState(true);
  const [showTerminal, setShowTerminal] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [fileSearchQuery, setFileSearchQuery] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  // Explorer action modals & inline prompts
  const [newItemType, setNewItemType] = useState<"file" | "folder" | null>(null);
  const [newItemParentPath, setNewItemParentPath] = useState<string>("");
  const [newItemName, setNewItemName] = useState("");
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renamingNewName, setRenamingNewName] = useState("");
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  // Preview state
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [deviceMode, setDeviceMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const ensureRef = useRef<Promise<void> | null>(null);

  const activeTab = useMemo(
    () => tabs.find((t) => t.path === activeTabPath) || null,
    [tabs, activeTabPath]
  );

  // Open / Focus a file into the Tab System
  const openFile = useCallback(
    async (rawPath: string) => {
      const normalized = rawPath
        .replace(/^\/home\/user\//, "")
        .replace(/^home\/user\//, "")
        .replace(/^\.\//, "");

      let alreadyExists = false;
      setTabs((prev) => {
        if (prev.some((t) => t.path === normalized)) {
          alreadyExists = true;
        }
        return prev;
      });

      if (alreadyExists) {
        setActiveTabPath(normalized);
        return;
      }

      try {
        const content = await fetchFile(sessionId, normalized);
        const fileName = normalized.split("/").pop() || normalized;
        const newTab: EditorTab = {
          path: normalized,
          name: fileName,
          content,
          savedContent: content,
          isDirty: false,
        };
        setTabs((prev) => {
          if (prev.some((t) => t.path === normalized)) return prev;
          return [...prev, newTab];
        });
        setActiveTabPath(normalized);
      } catch (err) {
        console.error("Failed to open file:", err);
        const fileName = normalized.split("/").pop() || normalized;
        const fallbackTab: EditorTab = {
          path: normalized,
          name: fileName,
          content: `// Erreur de lecture du fichier : ${normalized}\n// ${err instanceof Error ? err.message : String(err)}`,
          savedContent: "",
          isDirty: false,
        };
        setTabs((prev) => {
          if (prev.some((t) => t.path === normalized)) return prev;
          return [...prev, fallbackTab];
        });
        setActiveTabPath(normalized);
      }
    },
    [sessionId]
  );

  // Close a tab
  const closeTab = useCallback(
    (path: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      const tabToClose = tabs.find((t) => t.path === path);
      if (tabToClose?.isDirty) {
        const confirmClose = window.confirm(
          `Le fichier "${tabToClose.name}" contient des modifications non enregistrées. Voulez-vous vraiment le fermer ?`
        );
        if (!confirmClose) return;
      }

      setTabs((prev) => {
        const next = prev.filter((t) => t.path !== path);
        if (activeTabPath === path) {
          const nextActive = next.length > 0 ? next[next.length - 1].path : null;
          setActiveTabPath(nextActive);
        }
        return next;
      });
    },
    [tabs, activeTabPath]
  );

  // Close all tabs
  const closeAllTabs = useCallback(() => {
    const dirtyTabs = tabs.filter((t) => t.isDirty);
    if (dirtyTabs.length > 0) {
      const confirmClose = window.confirm(
        `Vous avez ${dirtyTabs.length} fichier(s) non enregistré(s). Fermer tous les onglets ?`
      );
      if (!confirmClose) return;
    }
    setTabs([]);
    setActiveTabPath(null);
  }, [tabs]);

  // Update tab content on edit
  const handleContentChange = useCallback(
    (newContent: string | undefined) => {
      if (!activeTabPath || newContent === undefined) return;
      setTabs((prev) =>
        prev.map((t) => {
          if (t.path === activeTabPath) {
            const isDirty = newContent !== t.savedContent;
            return { ...t, content: newContent, isDirty };
          }
          return t;
        })
      );
    },
    [activeTabPath]
  );

  // Real Save handler
  const handleSaveActiveFile = useCallback(async () => {
    if (!activeTab) return;
    setSaveStatus("saving");
    setSaveErrorMessage(null);

    try {
      await saveWorkspaceFile(sessionId, activeTab.path, activeTab.content);
      setTabs((prev) =>
        prev.map((t) =>
          t.path === activeTab.path
            ? { ...t, savedContent: t.content, isDirty: false }
            : t
        )
      );
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
      onRefreshFiles?.();
    } catch (err) {
      setSaveStatus("error");
      setSaveErrorMessage(err instanceof Error ? err.message : "Erreur de sauvegarde");
      setTimeout(() => setSaveStatus("idle"), 4000);
    }
  }, [activeTab, sessionId, onRefreshFiles]);

  // Hotkey ⌘S / Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void handleSaveActiveFile();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSaveActiveFile]);

  // Initial file auto-selection
  useEffect(() => {
    if (filePaths.length && tabs.length === 0 && !activeTabPath) {
      const preferred =
        filePaths.find((p) => p === "src/App.tsx") ??
        filePaths.find((p) => p === "main.py") ??
        filePaths.find((p) => p.endsWith(".tsx") || p.endsWith(".jsx")) ??
        filePaths.find((p) => p.endsWith(".py")) ??
        filePaths.find((p) => p.includes("/") && !p.split("/").some((s) => s.startsWith("."))) ??
        filePaths.find((p) => p.includes(".")) ??
        filePaths[0];
      if (preferred) void openFile(preferred);
    }
  }, [filePaths, tabs.length, activeTabPath, openFile]);

  // Preview Runner
  const ensurePreviewRunning = useCallback(
    async (force = false) => {
      if (!force && ensureRef.current) {
        setPreviewLoading(true);
        return ensureRef.current;
      }

      const task = (async () => {
        setPreviewLoading(true);
        setPreviewError(null);
        try {
          const result = await ensurePreview(sessionId);
          if (result.preview_url) {
            onPreviewUrl?.(result.preview_url);
            if (iframeRef.current) {
              iframeRef.current.src = "";
              iframeRef.current.src = result.preview_url;
            }
          } else if (result.status === "error") {
            onPreviewUrl?.(null);
            setPreviewError(result.output ?? "Échec du démarrage du serveur");
          } else if (result.status === "no_sandbox") {
            setPreviewError("Sandbox en cours d'initialisation...");
          }
        } catch (e) {
          setPreviewError(e instanceof Error ? e.message : "Erreur chargement aperçu");
        } finally {
          setPreviewLoading(false);
          ensureRef.current = null;
        }
      })();

      ensureRef.current = task;
      return task;
    },
    [sessionId, onPreviewUrl]
  );

  useEffect(() => {
    if (previewUrl && iframeRef.current) {
      iframeRef.current.src = previewUrl;
    }
  }, [previewUrl]);

  useEffect(() => {
    if (activeMode === "code") return;
    if (filePaths.length === 0) return;
    if (previewUrl) return;
    void ensurePreviewRunning();
  }, [activeMode, filePaths.length, previewUrl, ensurePreviewRunning]);

  // Handle File Creation
  const handleCreateNewItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemType) return;
    setActionLoading(true);

    const fullPath = newItemParentPath
      ? `${newItemParentPath}/${newItemName.trim()}`
      : newItemName.trim();

    try {
      if (newItemType === "file") {
        await createWorkspaceFile(sessionId, fullPath, "");
        setNewItemType(null);
        setNewItemName("");
        onRefreshFiles?.();
        void openFile(fullPath);
      } else {
        await createWorkspaceFolder(sessionId, fullPath);
        setNewItemType(null);
        setNewItemName("");
        onRefreshFiles?.();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Échec de la création");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Rename
  const handleRenameItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingPath || !renamingNewName.trim()) return;
    setActionLoading(true);

    const pathSegments = renamingPath.split("/");
    pathSegments[pathSegments.length - 1] = renamingNewName.trim();
    const newPath = pathSegments.join("/");

    try {
      await renameWorkspacePath(sessionId, renamingPath, newPath);
      // Update open tabs if renamed
      setTabs((prev) =>
        prev.map((t) => {
          if (t.path === renamingPath) {
            return { ...t, path: newPath, name: renamingNewName.trim() };
          }
          if (t.path.startsWith(`${renamingPath}/`)) {
            const suffix = t.path.slice(renamingPath.length);
            return { ...t, path: `${newPath}${suffix}` };
          }
          return t;
        })
      );
      if (activeTabPath === renamingPath) {
        setActiveTabPath(newPath);
      }
      setRenamingPath(null);
      setRenamingNewName("");
      onRefreshFiles?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Échec du renommage");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Delete
  const handleDeleteItem = async (path: string) => {
    setActionLoading(true);
    try {
      await deleteWorkspacePath(sessionId, path);
      // Close tabs for deleted files
      setTabs((prev) =>
        prev.filter((t) => t.path !== path && !t.path.startsWith(`${path}/`))
      );
      if (activeTabPath === path || activeTabPath?.startsWith(`${path}/`)) {
        setActiveTabPath(null);
      }
      setDeletingPath(null);
      onRefreshFiles?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Échec de la suppression");
    } finally {
      setActionLoading(false);
    }
  };

  // Copy Relative Path
  const handleCopyPath = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 1500);
  };

  // Filtered File Tree
  const filteredFilePaths = useMemo(() => {
    if (!fileSearchQuery.trim()) return filePaths;
    const q = fileSearchQuery.toLowerCase();
    return filePaths.filter((p) => p.toLowerCase().includes(q));
  }, [filePaths, fileSearchQuery]);

  const tree = useMemo(() => buildFileTree(filteredFilePaths), [filteredFilePaths]);

  // Collapse / Expand all
  const handleToggleExpandAll = () => {
    if (collapsed.size === 0) {
      // Collapse all directories
      const allDirs = new Set<string>();
      filePaths.forEach((p) => {
        const parts = p.split("/");
        for (let i = 1; i < parts.length; i++) {
          allDirs.add(parts.slice(0, i).join("/"));
        }
      });
      setCollapsed(allDirs);
    } else {
      setCollapsed(new Set());
    }
  };

  // File Icon Picker (OpenCode Desktop style)
  const renderFileIcon = (fileName: string, isSelected: boolean) => {
    return <FileIcon fileName={fileName} isSelected={isSelected} className="h-3.5 w-3.5 shrink-0" />;
  };

  // Recursive Tree Node Renderer
  const FileTreeNode = ({ node, depth = 0 }: { node: FileNode; depth?: number }) => {
    const isCollapsed = collapsed.has(node.path);
    const isSelected = activeTabPath === node.path;
    const isDirty = tabs.some((t) => t.path === node.path && t.isDirty);

    if (node.type === "file") {
      return (
        <div
          className={`group flex items-center justify-between rounded-lg px-2 py-1 text-xs transition cursor-pointer ${
            isSelected
              ? "bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold shadow-2xs"
              : "text-[var(--foreground)] hover:bg-[var(--surface-hover)] font-medium"
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => openFile(node.path)}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {renderFileIcon(node.name, isSelected)}
            <span className="truncate text-left text-[12px]">{node.name}</span>
            {isDirty && (
              <span
                className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                  isSelected ? "bg-white" : "bg-amber-400"
                }`}
                title="Modifications non sauvegardées"
              />
            )}
          </div>

          {/* Action Tools on Hover */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              type="button"
              onClick={(e) => handleCopyPath(node.path, e)}
              className={`p-1 rounded hover:bg-black/10 transition ${
                isSelected ? "text-white" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
              title="Copier le chemin"
            >
              {copiedPath === node.path ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setRenamingPath(node.path);
                setRenamingNewName(node.name);
              }}
              className={`p-1 rounded hover:bg-black/10 transition ${
                isSelected ? "text-white" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
              title="Renommer le fichier"
            >
              <Edit2 className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDeletingPath(node.path);
              }}
              className={`p-1 rounded hover:bg-red-500/20 text-red-400 transition`}
              title="Supprimer le fichier"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      );
    }

    return (
      <div>
        <div
          className="group flex items-center justify-between rounded-lg px-2 py-1 text-xs text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition cursor-pointer font-medium"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => {
            setCollapsed((prev) => {
              const next = new Set(prev);
              if (next.has(node.path)) next.delete(node.path);
              else next.add(node.path);
              return next;
            });
          }}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
            )}
            {isCollapsed ? (
              <Folder className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            ) : (
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            )}
            <span className="truncate text-left text-[12px] font-medium">{node.name}</span>
          </div>

          {/* Folder action buttons */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setNewItemParentPath(node.path);
                setNewItemType("file");
                setNewItemName("");
              }}
              className="p-1 rounded text-[var(--muted-foreground)] hover:bg-[var(--surface)] hover:text-[var(--foreground)] transition"
              title="Nouveau fichier dans ce dossier"
            >
              <FilePlus className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setNewItemParentPath(node.path);
                setNewItemType("folder");
                setNewItemName("");
              }}
              className="p-1 rounded text-[var(--muted-foreground)] hover:bg-[var(--surface)] hover:text-[var(--foreground)] transition"
              title="Nouveau sous-dossier"
            >
              <FolderPlus className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setRenamingPath(node.path);
                setRenamingNewName(node.name);
              }}
              className="p-1 rounded text-[var(--muted-foreground)] hover:bg-[var(--surface)] hover:text-[var(--foreground)] transition"
              title="Renommer le dossier"
            >
              <Edit2 className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDeletingPath(node.path);
              }}
              className="p-1 rounded text-red-400 hover:bg-red-500/10 transition"
              title="Supprimer le dossier"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {!isCollapsed &&
          node.children?.map((child, i) => (
            <FileTreeNode key={i} node={child} depth={depth + 1} />
          ))}
      </div>
    );
  };

  // Breadcrumbs Generator
  const renderBreadcrumbs = () => {
    if (!activeTab) return null;
    const segments = activeTab.path.split("/");
    return (
      <div className="flex items-center gap-1 overflow-x-auto text-[11px] text-[var(--muted-foreground)] select-none">
        <span className="font-semibold text-[var(--primary)]">workspace</span>
        {segments.map((seg, idx) => (
          <div key={idx} className="flex items-center gap-1 shrink-0">
            <span className="opacity-40">/</span>
            <span
              className={
                idx === segments.length - 1
                  ? "font-semibold text-[var(--foreground)]"
                  : "hover:text-[var(--foreground)] cursor-pointer"
              }
            >
              {seg}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Code Editor Subview
  const renderCodeEditor = () => (
    <div className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
      {/* File Explorer Sidebar */}
      {showFileExplorer && (
        <div className="flex w-60 shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] select-none">
          {/* Header & Quick Action Buttons */}
          <div className="shrink-0 flex items-center justify-between border-b border-[var(--border)] px-3 py-2 bg-[var(--surface-elevated)]/60">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--primary)]">
              <FolderTree className="h-3.5 w-3.5" />
              <span>Explorateur</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setNewItemParentPath("");
                  setNewItemType("file");
                  setNewItemName("");
                }}
                className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition cursor-pointer"
                title="Nouveau fichier à la racine"
              >
                <FilePlus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewItemParentPath("");
                  setNewItemType("folder");
                  setNewItemName("");
                }}
                className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition cursor-pointer"
                title="Nouveau dossier à la racine"
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleToggleExpandAll}
                className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition cursor-pointer"
                title={collapsed.size === 0 ? "Tout réduire" : "Tout déplier"}
              >
                <FolderArchive className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onRefreshFiles?.()}
                className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--primary)] transition cursor-pointer"
                title="Actualiser le workspace"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowFileExplorer(false)}
                className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition cursor-pointer"
                title="Masquer l'explorateur"
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Fast Search input for files */}
          <div className="px-2.5 py-1.5 border-b border-[var(--border)] bg-[var(--surface)]">
            <div className="relative flex items-center">
              <Search className="absolute left-2 h-3 w-3 text-[var(--muted-foreground)] pointer-events-none" />
              <input
                type="text"
                placeholder="Filtrer les fichiers..."
                value={fileSearchQuery}
                onChange={(e) => setFileSearchQuery(e.target.value)}
                className="w-full pl-6 pr-6 py-1 text-[11px] rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--primary)] transition"
              />
              {fileSearchQuery && (
                <button
                  type="button"
                  onClick={() => setFileSearchQuery("")}
                  className="absolute right-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Tree View Content */}
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-0.5 p-2">
              {tree.length ? (
                tree.map((node, i) => <FileTreeNode key={i} node={node} depth={0} />)
              ) : (
                <div className="px-2 py-6 text-center space-y-2">
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {fileSearchQuery
                      ? `Aucun fichier trouvé pour "${fileSearchQuery}"`
                      : "Aucun fichier dans ce workspace."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setNewItemParentPath("");
                      setNewItemType("file");
                      setNewItemName("App.tsx");
                    }}
                    className="text-[11px] font-semibold text-[var(--primary)] hover:underline flex items-center justify-center gap-1 mx-auto cursor-pointer"
                  >
                    <FilePlus className="h-3 w-3" />
                    <span>Créer un premier fichier</span>
                  </button>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Editor Main Canvas */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
        {/* Tab Strip Bar */}
        <div className="shrink-0 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-elevated)]/80 backdrop-blur-sm overflow-x-auto select-none">
          <div className="flex items-center min-w-0 flex-1 overflow-x-auto">
            {!showFileExplorer && (
              <button
                type="button"
                onClick={() => setShowFileExplorer(true)}
                className="flex h-9 w-9 shrink-0 items-center justify-center border-r border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--primary)] transition cursor-pointer"
                title="Afficher l'explorateur de fichiers"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}

            {tabs.map((tab, idx) => {
              const isActive = activeTabPath === tab.path;
              return (
                <div
                  key={`${tab.path}-${idx}`}
                  onClick={() => setActiveTabPath(tab.path)}
                  className={`group relative flex h-9 items-center gap-2 border-r border-[var(--border)] px-3 text-xs transition cursor-pointer shrink-0 ${
                    isActive
                      ? "bg-[var(--background)] text-[var(--foreground)] font-semibold border-b-2 border-b-[var(--primary)]"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] font-medium"
                  }`}
                  title={tab.path}
                >
                  {renderFileIcon(tab.name, false)}
                  <span className="truncate max-w-[140px] text-[12px]">{tab.name}</span>
                  {tab.isDirty && (
                    <span
                      className="h-2 w-2 rounded-full bg-amber-400 shrink-0 animate-pulse"
                      title="Modifications non enregistrées"
                    />
                  )}
                  <button
                    type="button"
                    onClick={(e) => closeTab(tab.path, e)}
                    className="rounded p-0.5 text-[var(--muted-foreground)] hover:bg-[var(--surface)] hover:text-[var(--foreground)] transition cursor-pointer opacity-70 group-hover:opacity-100"
                    title="Fermer l'onglet"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}

            {tabs.length === 0 && (
              <div className="flex items-center px-4 text-xs text-[var(--muted-foreground)] italic">
                Aucun fichier ouvert
              </div>
            )}
          </div>

          {/* Quick Actions (Save, Close All) */}
          <div className="flex items-center gap-1 px-2 shrink-0">
            {activeTab && (
              <button
                type="button"
                onClick={handleSaveActiveFile}
                disabled={saveStatus === "saving" || !activeTab.isDirty}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                  activeTab.isDirty
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-xs hover:opacity-95"
                    : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)] opacity-70"
                }`}
                title="Enregistrer (⌘S ou Ctrl+S)"
              >
                {saveStatus === "saving" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : saveStatus === "saved" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">
                  {saveStatus === "saving"
                    ? "Enregistrement..."
                    : saveStatus === "saved"
                      ? "Enregistré"
                      : "Enregistrer"}
                </span>
              </button>
            )}

            {tabs.length > 1 && (
              <button
                type="button"
                onClick={closeAllTabs}
                className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition cursor-pointer"
                title="Fermer tous les onglets"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Breadcrumbs & Status Bar */}
        {activeTab && (
          <div className="shrink-0 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-3 py-1.5">
            {renderBreadcrumbs()}
            <div className="flex items-center gap-2">
              {saveStatus === "error" && (
                <span className="flex items-center gap-1 text-[11px] font-medium text-red-500">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{saveErrorMessage || "Échec de sauvegarde"}</span>
                </span>
              )}
              <span className="rounded bg-[var(--surface-hover)] px-2 py-0.5 font-mono text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider">
                {getFileLanguageLabel(activeTab.path)}
              </span>
            </div>
          </div>
        )}

        {/* Monaco Editor Container */}
        <div className="min-h-0 flex-1">
          {activeTab ? (
            <MonacoEditor
              key={activeTab.path}
              height="100%"
              language={getFileLanguage(activeTab.path)}
              value={activeTab.content}
              onChange={handleContentChange}
              options={{
                readOnly: false,
                minimap: { enabled: true },
                fontSize: 13,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: "on",
                theme: resolvedIsDark ? "vs-dark" : "vs-light",
              }}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-[var(--muted-foreground)] p-6 text-center h-full">
              <Code className="h-12 w-12 text-[var(--muted-foreground)] opacity-30 mb-3" />
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Aucun fichier sélectionné
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1 max-w-sm">
                Sélectionnez un fichier dans l&apos;explorateur à gauche pour commencer à éditer votre code.
              </p>
              {!showFileExplorer && (
                <button
                  type="button"
                  onClick={() => setShowFileExplorer(true)}
                  className="mt-4 flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition cursor-pointer"
                >
                  <PanelLeftOpen className="h-3.5 w-3.5 text-[var(--primary)]" />
                  <span>Ouvrir l&apos;explorateur</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Creation Modal (File / Folder) */}
      {newItemType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreateNewItem}
            className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--foreground)]">
              {newItemType === "file" ? (
                <FilePlus className="h-4 w-4 text-[var(--primary)]" />
              ) : (
                <FolderPlus className="h-4 w-4 text-amber-500" />
              )}
              <span>
                {newItemType === "file" ? "Nouveau fichier" : "Nouveau dossier"}
              </span>
            </div>
            {newItemParentPath && (
              <p className="text-xs text-[var(--muted-foreground)]">
                Dossier parent : <span className="font-mono text-[var(--foreground)]">{newItemParentPath}</span>
              </p>
            )}
            <input
              type="text"
              placeholder={newItemType === "file" ? "ex: components/Header.tsx" : "ex: utils"}
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNewItemType(null)}
                className="px-3 py-1.5 text-xs rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)]"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={actionLoading || !newItemName.trim()}
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
              >
                {actionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                <span>Créer</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rename Modal */}
      {renamingPath && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <form
            onSubmit={handleRenameItem}
            className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--foreground)]">
              <Edit2 className="h-4 w-4 text-[var(--primary)]" />
              <span>Renommer</span>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] truncate font-mono">
              {renamingPath}
            </p>
            <input
              type="text"
              value={renamingNewName}
              onChange={(e) => setRenamingNewName(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRenamingPath(null)}
                className="px-3 py-1.5 text-xs rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)]"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={actionLoading || !renamingNewName.trim()}
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
              >
                {actionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                <span>Renommer</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Deletion Confirmation Modal */}
      {deletingPath && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-red-500/30 bg-[var(--surface)] p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-red-500">
              <Trash2 className="h-4 w-4" />
              <span>Confirmer la suppression</span>
            </div>
            <p className="text-xs text-[var(--foreground)]">
              Voulez-vous vraiment supprimer définitivement cet élément du workspace ?
            </p>
            <p className="text-xs font-mono text-red-400 bg-red-500/10 p-2 rounded-lg truncate">
              {deletingPath}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingPath(null)}
                className="px-3 py-1.5 text-xs rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => handleDeleteItem(deletingPath)}
                disabled={actionLoading}
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {actionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                <span>Supprimer</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderLiveDemo = () => (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--background)]">
      <div className="relative m-0 min-h-0 flex-1 overflow-auto p-0 sm:p-4">
        {previewUrl ? (
          <div className="flex h-full w-full items-center justify-center">
            <div
              className={`relative transition-all duration-300 bg-[var(--surface-elevated)] ${
                deviceMode === "mobile"
                  ? "h-[667px] w-[375px] max-h-full max-w-full rounded-3xl border-8 border-[var(--border)] shadow-2xl overflow-hidden"
                  : deviceMode === "tablet"
                    ? "h-[900px] w-[768px] max-h-full max-w-full rounded-2xl border-8 border-[var(--border)] shadow-2xl overflow-hidden"
                    : "h-full w-full shadow-md"
              }`}
            >
              <iframe
                ref={iframeRef}
                src={previewUrl}
                className="h-full w-full border-0 bg-[var(--background)]"
                title="Live Application Preview"
              />
              {previewLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[var(--background)]/90 text-[var(--muted-foreground)]">
                  <Loader2 className="mb-3 h-10 w-10 animate-spin text-[var(--primary)]" />
                  <p className="text-xs font-semibold">Démarrage du serveur dev...</p>
                </div>
              )}
              {previewError && !previewLoading && (
                <p className="absolute bottom-4 left-1/2 z-10 max-w-md -translate-x-1/2 rounded border border-red-500/30 bg-[var(--surface-elevated)] px-3 py-2 text-xs text-red-500 shadow">
                  {previewError}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--muted-foreground)]">
            <div className="space-y-3 text-center">
              {previewLoading ? (
                <>
                  <Loader2 className="mx-auto h-10 w-10 animate-spin text-[var(--primary)]" />
                  <p className="text-sm font-semibold">Initialisation de l&apos;application...</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Démarrage du dev server sur le port 3000</p>
                </>
              ) : (
                <>
                  <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-[var(--surface-elevated)] text-[var(--muted-foreground)]">
                    <Monitor className="h-6 w-6 text-[var(--primary)]" />
                  </div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">Aucun aperçu disponible</p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Lancez le serveur dev ou demandez à l&apos;agent d&apos;exécuter l&apos;application.
                  </p>
                  <button
                    type="button"
                    onClick={() => ensurePreviewRunning(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-bold text-[var(--primary-foreground)] shadow hover:opacity-90 cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Lancer le serveur</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--background)]">
      {/* Top Controls Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 select-none">
        <div className="flex items-center gap-1.5">
          {/* View Mode Switcher: Code / Live / Split */}
          <div className="flex items-center rounded-lg bg-[var(--background)] p-0.5 border border-[var(--border)]">
            <button
              type="button"
              onClick={() => setActiveMode("code")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                activeMode === "code"
                  ? "bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-xs"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
              title="Afficher l'éditeur de code et l'explorateur"
            >
              <Code className="h-3.5 w-3.5 text-[var(--primary)]" />
              <span>Code</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("demo")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                activeMode === "demo"
                  ? "bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-xs"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
              title="Afficher l'aperçu Live Web"
            >
              <Monitor className="h-3.5 w-3.5 text-emerald-500" />
              <span>Aperçu Live</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("split")}
              className={`hidden sm:flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                activeMode === "split"
                  ? "bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-xs"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
              title="Afficher le Code et l'Aperçu côte à côte"
            >
              <Columns className="h-3.5 w-3.5 text-blue-500" />
              <span>Split View</span>
            </button>
          </div>

          {/* Device Switcher */}
          {(activeMode === "demo" || activeMode === "split") && previewUrl && (
            <div className="hidden md:flex items-center rounded-lg bg-[var(--surface)] p-0.5 ml-1 border border-[var(--border)]">
              <button
                type="button"
                onClick={() => setDeviceMode("desktop")}
                className={`flex h-6 w-6 items-center justify-center rounded-md transition cursor-pointer ${
                  deviceMode === "desktop"
                    ? "bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-xs"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
                title="Vue Bureau"
              >
                <Laptop className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setDeviceMode("tablet")}
                className={`flex h-6 w-6 items-center justify-center rounded-md transition cursor-pointer ${
                  deviceMode === "tablet"
                    ? "bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-xs"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
                title="Vue Tablette (768px)"
              >
                <Tablet className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setDeviceMode("mobile")}
                className={`flex h-6 w-6 items-center justify-center rounded-md transition cursor-pointer ${
                  deviceMode === "mobile"
                    ? "bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-xs"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
                title="Vue Mobile (375px)"
              >
                <Smartphone className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-1.5">
          {(activeMode === "code" || activeMode === "split") && (
            <button
              type="button"
              onClick={() => setShowFileExplorer((v) => !v)}
              className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition cursor-pointer ${
                showFileExplorer
                  ? "border-[var(--primary)]/40 bg-[var(--primary)]/10 text-[var(--primary)]"
                  : "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              }`}
              title={showFileExplorer ? "Masquer l'explorateur" : "Afficher l'explorateur"}
            >
              <FolderTree className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Fichiers</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowTerminal((v) => !v)}
            className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition cursor-pointer ${
              showTerminal
                ? "border-[var(--primary)]/40 bg-[var(--primary)]/10 text-[var(--primary)]"
                : "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            }`}
            title={showTerminal ? "Masquer le Terminal" : "Afficher le Terminal"}
          >
            <TerminalIcon className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Terminal</span>
          </button>

          {(activeMode === "demo" || activeMode === "split") && (
            <>
              <button
                type="button"
                onClick={() => ensurePreviewRunning(true)}
                disabled={previewLoading}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] disabled:opacity-50 transition cursor-pointer"
                title="Recompiler et rafraîchir l'aperçu"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${previewLoading ? "animate-spin text-[var(--primary)]" : ""}`} />
              </button>
              {previewUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition cursor-pointer"
                  title="Ouvrir dans un nouvel onglet"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {showTerminal ? (
          <ResizablePanelGroup direction="vertical" className="h-full min-h-0">
            <ResizablePanel defaultSize={72} minSize={30} className="min-h-0">
              {activeMode === "code" && renderCodeEditor()}
              {activeMode === "demo" && renderLiveDemo()}
              {activeMode === "split" && (
                <ResizablePanelGroup direction="horizontal" className="h-full min-h-0">
                  <ResizablePanel defaultSize={50} minSize={25} className="min-w-0">
                    {renderCodeEditor()}
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize={50} minSize={25} className="min-w-0">
                    {renderLiveDemo()}
                  </ResizablePanel>
                </ResizablePanelGroup>
              )}
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={28} minSize={15} className="min-h-0">
              <div className="flex h-full min-h-0 flex-col overflow-hidden border-t border-[var(--border)] bg-[var(--surface-elevated)]">
                <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <TerminalIcon className="h-3.5 w-3.5 text-[var(--primary)]" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--foreground)]">
                      Console Terminal & Dev Server
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTerminal(false)}
                    className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] cursor-pointer"
                    title="Masquer la console"
                  >
                    <PanelBottomClose className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="min-h-0 flex-1">
                  <Terminal
                    sessionId={sessionId}
                    providerId={providerId}
                    onPortDetected={(port) => {
                      if (port) {
                        onPreviewUrl?.(`/api/preview/${sessionId}`);
                      }
                    }}
                  />
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="h-full min-h-0">
            {activeMode === "code" && renderCodeEditor()}
            {activeMode === "demo" && renderLiveDemo()}
            {activeMode === "split" && (
              <ResizablePanelGroup direction="horizontal" className="h-full min-h-0">
                <ResizablePanel defaultSize={50} minSize={25} className="min-w-0">
                  {renderCodeEditor()}
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={50} minSize={25} className="min-w-0">
                  {renderLiveDemo()}
                </ResizablePanel>
              </ResizablePanelGroup>
            )}
          </div>
        )}
      </div>

      <ImportRepoModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        sessionId={sessionId}
        onImportSuccess={() => {
          onRefreshFiles?.();
        }}
      />
    </div>
  );
}
