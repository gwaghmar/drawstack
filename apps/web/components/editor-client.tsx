"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toPng, toSvg } from "html-to-image";
import { Logo } from "@/components/logo";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  Sparkles,
  ArrowUp,
  Bot,
  Undo,
  Redo,
  Share2,
  Settings2,
  Play,
  CheckCircle2,
  AlertCircle,
  Circle,
  Loader2,
  ChevronDown,
  Clock,
  Palette,
  Code2,
  Search,
  ChevronUp,
  X,
  Moon,
  Sun,
  LayoutTemplate,
  Command,
  Zap,
} from "lucide-react";
import { CommandPalette, type CommandPaletteAction } from "@/components/command-palette";
import { motion, AnimatePresence } from "framer-motion";
import { Group, Panel, Separator, type PanelImperativeHandle } from "react-resizable-panels";
import {
  THEMES,
  getDiagramTypeMeta,
  type DiagramType,
  type UseCaseId,
} from "@flowchart/core";
import Link from "next/link";
import { DiagramTypeIcon } from "@/components/diagram-icon";
import { highlightSource } from "@/lib/source-highlight";
import { applyPatch, isValidJson } from "@/lib/agent-tools";
import { downloadSource, sourceFileExtension } from "@/lib/diagrams/source-export";
import { usePresence, presenceColor } from "@/lib/use-presence";
import { saveProject, createProject, listRevisions, restoreRevision } from "@/app/actions/project";
import { getBrandKit } from "@/app/actions/brand-kit";
import { createShareLink } from "@/app/actions/share";
import dynamic from "next/dynamic";

const FreeformRenderer = dynamic(
  () => import("./diagrams/freeform-renderer").then((m) => ({ default: m.FreeformRenderer })),
  { ssr: false, loading: () => <CanvasLoader label="Canvas" /> }
);

function CanvasLoader({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-white text-slate-400">
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
        <span className="text-sm">Loading {label}…</span>
      </div>
    </div>
  );
}

type ChatMessage = { id: string; role: "assistant" | "user"; content: string };
type UiState = { showGrid?: boolean; fontId?: string; paletteId?: string; customBackground?: string; customAccent?: string; backgroundPattern?: string };
type FontOption = { id: string; label: string; cssValue: string };

const FONT_OPTIONS: FontOption[] = [
  { id: "geist", label: "Geist Sans", cssValue: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif" },
  { id: "inter", label: "Inter", cssValue: "Inter, ui-sans-serif, system-ui, sans-serif" },
  { id: "mono", label: "Geist Mono", cssValue: "var(--font-geist-mono), ui-monospace, monospace" },
  { id: "serif", label: "System Serif", cssValue: "ui-serif, Georgia, Cambria, serif" },
];

const UI_META_PREFIX = "%% ui:";
const UNDO_LIMIT = 50;

const BRACKET_PAIRS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  '"': '"',
  "'": "'",
  "`": "`",
};
const BRACKET_CLOSERS = new Set(Object.values(BRACKET_PAIRS));
const BRACKET_OPENERS = new Set(Object.keys(BRACKET_PAIRS));

function caretFromOffset(value: string, offset: number): { line: number; col: number } {
  const before = value.slice(0, offset);
  const newlineIdx = before.lastIndexOf("\n");
  const line = (before.match(/\n/g)?.length ?? 0) + 1;
  const col = offset - newlineIdx;
  return { line, col };
}

function parseUiFromSource(raw: string): { source: string; ui: UiState } {
  const lines = raw.split("\n");
  const first = lines[0]?.trim() ?? "";
  if (!first.startsWith(UI_META_PREFIX)) return { source: raw, ui: {} };
  try { return { source: lines.slice(1).join("\n"), ui: JSON.parse(first.slice(UI_META_PREFIX.length)) as UiState }; }
  catch { return { source: raw, ui: {} }; }
}
function summarizeDiagramSource(diagramType: DiagramType, source: string): string {
  const trimmed = source.trim();
  if (!trimmed) return "Empty diagram.";
  try {
    const parsed = JSON.parse(trimmed) as { shapes?: unknown[] };
    const count = Array.isArray(parsed.shapes) ? parsed.shapes.length : 0;
    return `Freeform canvas with ${count} shapes.`;
  } catch {
    return `${diagramType} source is present but not fully parseable.`;
  }
}

export type AiAssistantHint =
  | { kind: "byok"; providerLabel: string }
  | { kind: "server" }
  | { kind: "none" };

export type EditorClientProps = {
  initialSource: string;
  initialThemeId: string;
  initialTitle: string;
  initialDiagramType: DiagramType;
  projectId: string | null;
  showWatermark: boolean;
  aiAssistantHint?: AiAssistantHint;
  isExample?: boolean;
  creditsBalance?: number;
  initialPrompt?: string | null;
  initialWelcome?: boolean;
  userEmail?: string;
  userName?: string;
};

type Props = EditorClientProps;

function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
) {
  const openRef = useRef(open);
  openRef.current = open;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    function handler(e: MouseEvent | TouchEvent) {
      const target = e.target as Node | null;
      if (!target || !openRef.current) return;
      if (ref.current && !ref.current.contains(target)) onCloseRef.current();
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, []); // stable listener — reads live state via refs
}

export function EditorClient({
  initialSource,
  initialThemeId,
  initialTitle,
  initialDiagramType,
  projectId,
  showWatermark,
  aiAssistantHint = { kind: "none" },
  isExample = false,
  creditsBalance,
  initialPrompt,
  initialWelcome = false,
  userEmail = "user@example.com",
  userName = "You",
}: Props) {
  const router = useRouter();
  const parsedInitial = useMemo(() => parseUiFromSource(initialSource), [initialSource]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(projectId);
  const [source, setSource] = useState(parsedInitial.source);
  const [themeId, setThemeId] = useState(initialThemeId);
  const [title, setTitle] = useState(initialTitle);
  const [diagramType] = useState<DiagramType>(initialDiagramType);
  const [useCaseId, setUseCaseId] = useState<UseCaseId>("custom");
  const [pngScale, setPngScale] = useState<1 | 2 | 3>(2);
  const [showGrid, setShowGrid] = useState(Boolean(parsedInitial.ui.showGrid));
  const [fontId, setFontId] = useState(parsedInitial.ui.fontId ?? "geist");
  const [paletteId, setPaletteId] = useState(parsedInitial.ui.paletteId ?? "default");
  const [customBackground, setCustomBackground] = useState(parsedInitial.ui.customBackground ?? "#f8fafc");
  const [customAccent, setCustomAccent] = useState(parsedInitial.ui.customAccent ?? "#6366f1");
  const [parseError, setParseError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [backgroundPattern, setBackgroundPattern] = useState<"none" | "dots" | "grid" | "lines">(
    (parsedInitial.ui.backgroundPattern as "none" | "dots" | "grid" | "lines") ?? "none"
  );
  /** Raw source hidden by default; power users expand. Opens automatically on parse errors. */
  const [sourceExpanded, setSourceExpanded] = useState(true);
  /** Tools / chat column — hide for focus on diagram (persisted). */
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [showAiPopover, setShowAiPopover] = useState(false);
  const [sourcePanelOpen, setSourcePanelOpen] = useState(false);
  const [sourceCaret, setSourceCaret] = useState<{ line: number; col: number }>({ line: 1, col: 1 });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [searchActiveIdx, setSearchActiveIdx] = useState(0);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceQuery, setReplaceQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const chatPanelRef = useRef<PanelImperativeHandle>(null);

  // leftPanelOpen (toggled via ⌘B / the collapse button) is the single source
  // of truth; sync it into the resizable-panel library's own collapse state
  // rather than making the relationship bidirectional.
  useEffect(() => {
    const panel = chatPanelRef.current;
    if (!panel) return;
    if (leftPanelOpen && panel.isCollapsed()) panel.expand();
    else if (!leftPanelOpen && !panel.isCollapsed()) panel.collapse();
  }, [leftPanelOpen]);

  // Restore a saved width after mount only — reading localStorage during
  // render (as the library's own useDefaultLayout hook does) breaks Next.js
  // SSR, since the server has no localStorage.
  useEffect(() => {
    const saved = Number(window.localStorage.getItem("flowstudio-ai-chat-width"));
    if (Number.isFinite(saved) && saved > 0) chatPanelRef.current?.resize(saved);
  }, []);

  const handleChatGroupLayoutChanged = useCallback((_layout: unknown, meta: { isUserInteraction: boolean }) => {
    if (!meta.isUserInteraction) return;
    const panel = chatPanelRef.current;
    if (!panel || panel.isCollapsed()) return;
    window.localStorage.setItem("flowstudio-ai-chat-width", String(Math.round(panel.getSize().inPixels)));
  }, []);
  const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
  const [compactAiContext, setCompactAiContext] = useState(false);
  const [isAgentMode, setIsAgentMode] = useState(false);
  const [forceCreateNext, setForceCreateNext] = useState(false);
  const [pendingRevisionLabel, setPendingRevisionLabel] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [revisions, setRevisions] = useState<{ id: string; label: string | null; createdAt: Date }[]>([]);
  const [revisionsDirty, setRevisionsDirty] = useState(0);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [applyingBrand, setApplyingBrand] = useState(false);
  const presenceOthers = usePresence(currentProjectId, userEmail, userName);
  const [input, setInput] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [toolEffects, setToolEffects] = useState<Record<string, { status: "applied" | "noop" | "error"; label: string; detail?: string }>>({});
  const brandKitInFlight = useRef<Set<string>>(new Set());

  const bodyRef = useRef<Record<string, unknown>>({});
  useEffect(() => {
    bodyRef.current = {
      diagramType,
      themeId,
      title,
      currentSource: source.slice(0, compactAiContext ? 800 : 2000),
      diagramSummary: summarizeDiagramSource(diagramType, source),
      compact: compactAiContext,
      useCaseId,
      mode: forceCreateNext || !source.trim() ? "create" : "patch",
    };
  });

  useEffect(() => {
    const stored = localStorage.getItem("flowstudio-dark-mode");
    if (stored !== null) {
      setDarkMode(stored === "true");
    } else {
      setDarkMode(window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("flowstudio-dark-mode", String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    setCompactAiContext(localStorage.getItem("flowstudio-compact-ai-context") === "true");
  }, []);

  useEffect(() => {
    localStorage.setItem("flowstudio-compact-ai-context", String(compactAiContext));
  }, [compactAiContext]);

  // useChat binds the transport once; a useMemo keyed on isAgentMode does NOT
  // re-route after the toggle flips. Route per-request via a ref instead so the
  // Agent Mode toggle actually reaches /api/ai/agent.
  const isAgentModeRef = useRef(isAgentMode);
  isAgentModeRef.current = isAgentMode;
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/generate",
        prepareSendMessagesRequest: ({ messages, body }) => ({
          api: isAgentModeRef.current ? "/api/ai/agent" : "/api/ai/generate",
          body: { messages, ...bodyRef.current, ...(body ?? {}) },
        }),
      }),
    []
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getMessageText = (m: any): string =>
    Array.isArray(m?.parts)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? m.parts.filter((p: any) => p?.type === "text").map((p: any) => p.text ?? "").join("")
      : "";

  const { messages, sendMessage, status, setMessages } = useChat({
    transport,
    onFinish: async ({ message }) => {
      const text = getMessageText(message);
      if (text.trim()) {
        const cleaned = cleanModelOutput(text);
        if (cleaned && cleaned.trim() !== source.trim()) {
          setSource(cleaned);
        }
      }
      showToast("Diagram updated · ⌘Z to undo");
      const lastUserMsg = messages.filter((m) => m.role === "user").slice(-1)[0];
      const lastUserInput = lastUserMsg ? getMessageText(lastUserMsg).trim() : "";
      const promptSnippet = lastUserInput.slice(0, 60);
      const aiLabel = forceCreateNext
        ? `AI regenerated${promptSnippet ? `: ${promptSnippet}` : ""}`
        : `AI patched${promptSnippet ? `: ${promptSnippet}` : ""}`;
      setPendingRevisionLabel(aiLabel);
      void handleSave(aiLabel);
      if (forceCreateNext) setForceCreateNext(false);
    },
    onError: (err) => {
      console.error("[ai-chat]", err);
      if (forceCreateNext) setForceCreateNext(false);
      const msg = err instanceof Error ? err.message : String(err);
      setAiError(msg.includes("API") || msg.includes("key") || msg.includes("auth")
        ? "AI unavailable — check your API key in Settings"
        : "AI request failed — please try again");
      showToast("AI request failed — please try again");
    },
  });

  const aiLoading = status === "submitted" || status === "streaming";

  // Real progress, not a hardcoded list: "submitted" genuinely means the intent
  // analysis call is running server-side (that's the only thing happening before
  // the stream opens). Once streaming starts, the data-progress part the server
  // writes (generate/route.ts) reflects the actual phase — generating, validating,
  // repairing, done — reconciled in place by its stable id rather than appended.
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const progressPart = useMemo(() => {
    if (!lastMessage || lastMessage.role !== "assistant") return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = Array.isArray((lastMessage as { parts?: unknown[] }).parts) ? (lastMessage as { parts: any[] }).parts : [];
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i]?.type === "data-progress") return parts[i].data as { step: string; label: string; status: "active" | "done" | "error" };
    }
    return null;
  }, [lastMessage]);

  const recordUndo = useCallback((snapshot: string) => {
    setUndoStack(prev => {
      if (prev[prev.length - 1] === snapshot) return prev;
      return [...prev.slice(-(UNDO_LIMIT - 1)), snapshot];
    });
    setRedoStack([]);
  }, []);

  const sendChatMessage = useCallback((text: string) => {
    // Snapshot pre-generation source here: the streaming effect mutates `source`
    // live, so recording undo in onFinish would capture the generated result.
    recordUndo(sourceRef.current);
    void sendMessage({ text });
  }, [sendMessage, recordUndo]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const streamData = useMemo<any[]>(() => {
    const out: unknown[] = [];
    for (const m of messages) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parts: any[] = Array.isArray((m as { parts?: unknown[] }).parts) ? (m as { parts: unknown[] }).parts as any[] : [];
      for (const p of parts) {
        if (p?.type === "data-meta" && p.data) out.push(p.data);
      }
    }
    return out;
  }, [messages]);

  const [assumptionBanner, setAssumptionBanner] = useState<string | null>(null);
  const [missingPieces, setMissingPieces] = useState<string[] | null>(null);
  const [clarificationOptions, setClarificationOptions] = useState<string[] | null>(null);
  const [followUpSuggestions, setFollowUpSuggestions] = useState<string[] | null>(null);

  // Handle incoming data stream (replacing experimental_onData)
  useEffect(() => {
    if (!streamData || streamData.length === 0) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = streamData[streamData.length - 1] as any;
    if (!meta) return;
    
    if (meta.assistantMessage) {
      setAiNotice(stripAiSlop(meta.assistantMessage));
      setFollowUpSuggestions(null); // a fresh reply supersedes any prior turn's suggestions
    }
    if (Array.isArray(meta.suggestedFollowUps)) {
      setFollowUpSuggestions(meta.suggestedFollowUps.length > 0 ? meta.suggestedFollowUps : null);
    }
    if (meta.needsClarification && Array.isArray(meta.clarificationOptions) && meta.clarificationOptions.length > 0) {
      setClarificationOptions(meta.clarificationOptions);
    } else if (meta.needsClarification === false || meta.assistantMessage) {
      setClarificationOptions(null);
    }
    // D-09/D-10: formatted "Generated as: …" banner after silent generation only.
    // Skip the banner for patch responses — assistantMessage already says "Patched existing diagram".
    if (meta.needsClarification === false && meta.resolvedSubtype && meta.generationMode !== "patch") {
      const detail = typeof meta.detailLevel === "string"
        ? meta.detailLevel.charAt(0).toUpperCase() + meta.detailLevel.slice(1)
        : "Medium";
      setAssumptionBanner(`Generated as: ${meta.resolvedSubtype} · ${detail} detail`);
    }
    // Dark-launched "missing pieces" hint — prompt-derived, informational only.
    if (
      process.env.NEXT_PUBLIC_MISSING_PIECES === "1" &&
      meta.detailLevel !== "low" &&
      Array.isArray(meta.missingInfo)
    ) {
      const PLACEHOLDERS = new Set(["domain specifics", "domain-specific details", "critical unknowns"]);
      const pieces = meta.missingInfo
        .map((s: unknown) => String(s).trim())
        .filter((s: string) => s.length > 0 && !PLACEHOLDERS.has(s.toLowerCase()));
      setMissingPieces(pieces.length > 0 ? pieces.slice(0, 5) : null);
    }
  }, [streamData]);

  useEffect(() => {
    if (!missingPieces) return;
    const t = setTimeout(() => setMissingPieces(null), 12000);
    return () => clearTimeout(t);
  }, [missingPieces]);

  // D-12: auto-dismiss assumption banner after 8 seconds
  useEffect(() => {
    if (!assumptionBanner) return;
    const t = setTimeout(() => setAssumptionBanner(null), 8000);
    return () => clearTimeout(t);
  }, [assumptionBanner]);

  // Server-side validation may emit a corrected source after the stream
  // ends (when the model's first attempt fails structural checks). Apply
  // it, replacing the in-progress streamed text.
  useEffect(() => {
    if (!streamData || streamData.length === 0) return;
    for (const entry of streamData) {
      const e = entry as { correctedSource?: string; validationRepaired?: boolean; validationFailed?: boolean; validationReason?: string };
      if (e?.validationRepaired && typeof e.correctedSource === "string" && e.correctedSource.length > 5) {
        setSource(e.correctedSource);
        setToast("AI output had a structural issue — automatically repaired.");
        setTimeout(() => setToast(null), 3000);
        break;
      }
      if (e?.validationFailed && e?.validationReason) {
        setToast(`AI output may be invalid: ${e.validationReason.slice(0, 80)}`);
        setTimeout(() => setToast(null), 3000);
        break;
      }
    }
  }, [streamData]);

  // Sync source with streaming AI response
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "assistant" && aiLoading) {
      const cleaned = cleanModelOutput(getMessageText(lastMessage));
      if (cleaned && cleaned.length > 5) {
        setSource(cleaned);
      }
    }
  }, [messages, aiLoading]);

  // Keep sourceRef current so tool effects can read latest source without stale closures.
  useEffect(() => { sourceRef.current = source; }, [source]);

  const handleUndo = useCallback(() => {
    setUndoStack(prev => {
      if (!prev.length) return prev;
      const snapshot = prev[prev.length - 1];
      setRedoStack(r => [sourceRef.current, ...r].slice(0, UNDO_LIMIT));
      setSource(snapshot);
      return prev.slice(0, -1);
    });
  }, []);

  const handleRedo = useCallback(() => {
    setRedoStack(prev => {
      if (!prev.length) return prev;
      const snapshot = prev[0];
      setUndoStack(u => [...u, sourceRef.current].slice(-UNDO_LIMIT));
      setSource(snapshot);
      return prev.slice(1);
    });
  }, []);

  const searchMatches = useMemo(() => {
    if (!searchQuery) return [] as number[];
    const hay = searchCaseSensitive ? source : source.toLowerCase();
    const needle = searchCaseSensitive ? searchQuery : searchQuery.toLowerCase();
    if (!needle) return [];
    const out: number[] = [];
    let i = 0;
    while (i <= hay.length - needle.length) {
      const idx = hay.indexOf(needle, i);
      if (idx === -1) break;
      out.push(idx);
      i = idx + Math.max(1, needle.length);
    }
    return out;
  }, [source, searchQuery, searchCaseSensitive]);

  useEffect(() => {
    if (searchActiveIdx >= searchMatches.length && searchMatches.length > 0) {
      setSearchActiveIdx(0);
    }
  }, [searchMatches.length, searchActiveIdx]);

  const focusMatch = useCallback((idx: number) => {
    const ta = sourceTextareaRef.current;
    if (!ta || searchMatches.length === 0) return;
    const safe = ((idx % searchMatches.length) + searchMatches.length) % searchMatches.length;
    const start = searchMatches[safe];
    const end = start + searchQuery.length;
    setSearchActiveIdx(safe);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start, end);
      const before = source.slice(0, start);
      const line = (before.match(/\n/g)?.length ?? 0) + 1;
      const lineHeight = 20;
      const scroller = sourceScrollRef.current;
      if (scroller) {
        const target = (line - 1) * lineHeight - 60;
        if (target < scroller.scrollTop || target > scroller.scrollTop + scroller.clientHeight - 80) {
          scroller.scrollTop = Math.max(0, target);
        }
      }
      setSourceCaret(caretFromOffset(source, end));
    });
  }, [searchMatches, searchQuery, source]);

  const replaceCurrent = useCallback(() => {
    if (searchMatches.length === 0) return;
    const start = searchMatches[searchActiveIdx] ?? searchMatches[0];
    const end = start + searchQuery.length;
    recordUndo(source);
    const next = source.slice(0, start) + replaceQuery + source.slice(end);
    setSource(next);
    requestAnimationFrame(() => {
      const ta = sourceTextareaRef.current;
      if (!ta) return;
      const caret = start + replaceQuery.length;
      ta.focus();
      ta.setSelectionRange(caret, caret);
      setSourceCaret(caretFromOffset(next, caret));
    });
  }, [searchMatches, searchActiveIdx, searchQuery, replaceQuery, source, recordUndo]);

  const replaceAll = useCallback(() => {
    if (searchMatches.length === 0) return;
    recordUndo(source);
    let next = "";
    let cursor = 0;
    for (const start of searchMatches) {
      next += source.slice(cursor, start) + replaceQuery;
      cursor = start + searchQuery.length;
    }
    next += source.slice(cursor);
    setSource(next);
  }, [searchMatches, searchQuery, replaceQuery, source, recordUndo]);

  const openSearch = useCallback(() => {
    setSourcePanelOpen(true);
    setSearchOpen(true);
    const ta = sourceTextareaRef.current;
    if (ta && ta.selectionStart !== ta.selectionEnd) {
      const selected = ta.value.slice(ta.selectionStart, ta.selectionEnd);
      if (selected && !selected.includes("\n")) setSearchQuery(selected);
    }
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
  }, []);

  // Keyboard shortcuts: Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z or Ctrl+Y = redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo(); else handleUndo();
      }
      if (e.key === "y") { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo, handleRedo]);

  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); }, []);
  const [exportOpen, setExportOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const exportWrapId = useId();
  const exportRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  useClickOutside(exportRef, exportOpen, () => setExportOpen(false));
  const sourcePanelBodyId = useId();
  const leftPanelHydrated = useRef(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const sourceScrollRef = useRef<HTMLDivElement>(null);
  const sourceTextareaRef = useRef<HTMLTextAreaElement>(null);
  const chatListRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef(source);
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const sourceAutoExpandedRef = useRef(false);
  const sourceSuppressAutoExpandRef = useRef(false);
  const lastSavedSnapshot = useRef(
    isExample
      ? JSON.stringify({ source: parsedInitial.source, themeId: initialThemeId, title: initialTitle })
      : ""
  );
  const hasHydratedRef = useRef(false);
  const promptAppendedRef = useRef(false);

  useEffect(() => {
    if (initialPrompt && !promptAppendedRef.current) {
      promptAppendedRef.current = true;
      setTimeout(() => {
        setLeftPanelOpen(true);
        sendChatMessage(initialPrompt);
        // Strip ?prompt and ?welcome from URL so a refresh doesn't re-trigger
        const params = new URLSearchParams(window.location.search);
        params.delete("prompt");
        params.delete("welcome");
        const newQuery = params.toString();
        router.replace(
          newQuery ? `/app/editor?${newQuery}` : "/app/editor",
          // @ts-ignore — scroll option is valid at runtime
          { scroll: false }
        );
        if (initialWelcome) {
          showToast("Welcome! Here's a sample diagram to get you started.");
        }
      }, 100);
    }
  }, [initialPrompt, initialWelcome, sendChatMessage, router, showToast]);

  const typeMeta = useMemo(() => getDiagramTypeMeta(diagramType), [diagramType]);
  const theme = useMemo(() => THEMES.find((t) => t.id === themeId) ?? THEMES[0], [themeId]);
  const bgColor = paletteId === "default" ? (theme.themeVariables.background ?? "#f8fafc") : customBackground;
  const uiState = useMemo(() => ({ showGrid, fontId, paletteId, customBackground, customAccent, backgroundPattern }), [showGrid, fontId, paletteId, customBackground, customAccent, backgroundPattern]);
  const sourceWithUi = source;

  // When loading an existing project, lastSavedSnapshot starts as "" — treat that as "saved" so we don't show "Unsaved" before any changes.
  const isDirty = useMemo(() => {
    if (lastSavedSnapshot.current === "" && projectId !== null) return false;
    return JSON.stringify({ source: sourceWithUi, themeId, title }) !== lastSavedSnapshot.current;
  }, [sourceWithUi, themeId, title, projectId]);
  /** Derive from isDirty + saving — avoid useEffect(setState) on isDirty (can contribute to update loops). */
  const saveState: "saved" | "saving" | "unsaved" = saving ? "saving" : isDirty ? "unsaved" : "saved";

  const handleApplyBrandKit = useCallback(async (opts?: { silent?: boolean }): Promise<boolean> => {
    setApplyingBrand(true);
    try {
      const kit = await getBrandKit();
      if (!kit || !kit.palette) {
        if (!opts?.silent) showToast("No brand kit yet — set one in Settings");
        return false;
      }
      if (!opts?.silent) recordUndo(source);
      setCustomAccent(kit.palette.primary);
      if (kit.palette.background) setCustomBackground(kit.palette.background);
      setPaletteId("brand");
      if (!opts?.silent) showToast(`Applied "${kit.name}" · ⌘Z to undo`);
      return true;
    } catch (e) {
      console.error("[brand-kit]", e);
      if (!opts?.silent) showToast("Could not apply brand kit");
      return false;
    } finally {
      setApplyingBrand(false);
    }
  }, [source, recordUndo, showToast]);

  // New diagrams only — never retroactively overwrite an existing saved
  // project's palette. currentProjectId is null and parsedInitial.ui is empty
  // exactly when this is a brand-new, unsaved diagram (see EditorClient mount
  // paths in app/app/editor/page.tsx, which always pass projectId={null} for
  // new diagrams, never an empty string).
  useEffect(() => {
    if (currentProjectId || parsedInitial.ui.paletteId) return;
    void handleApplyBrandKit({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cheap client-side backstop for the prose the model writes for the user to
  // read (chat replies, assumption notes, tool explanations) — never applied to
  // diagram source, where an em dash or "delve" could be legitimate user content
  // (a label, a title) rather than model filler.
  const stripAiSlop = (text: string) => {
    return text
      .replace(/\s*[—–]\s*/g, ", ")
      .replace(/\b(certainly|delve into|dive into|let's dive in|it's worth noting that|i'd be happy to)\b/gi, "")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/,\s*,/g, ",")
      .trim();
  };

  const cleanModelOutput = (text: string) => {
    // Strip markdown code blocks
    let cleaned = text.replace(/```[a-z]*\n?/gi, "").replace(/```/g, "");
    // Strip metadata prefix if AI included it in stream
    if (cleaned.includes(UI_META_PREFIX)) {
      cleaned = cleaned.split("\n").slice(1).join("\n");
    }
    return cleaned.trim();
  };

  // Keyboard shortcuts
  const handleSave = useCallback(async (labelOverride?: string) => {
    if (saving) return;
    setSaving(true);
    try {
      const sourceToSave = source;
      const label = labelOverride ?? pendingRevisionLabel ?? undefined;
      if (currentProjectId) {
        await saveProject(currentProjectId, { source: sourceToSave, themeId, title, diagramType }, label);
      }
      else {
        const newId = await createProject(title || "Untitled", sourceToSave, themeId, diagramType);
        setCurrentProjectId(newId);
      }
      lastSavedSnapshot.current = JSON.stringify({ source: sourceToSave, themeId, title });
      setPendingRevisionLabel(null);
      setRevisionsDirty((v) => v + 1);
      showToast("Project saved");
    } catch {
      showToast("Save failed — check your connection");
    } finally {
      setSaving(false);
    }
  }, [currentProjectId, source, uiState, themeId, title, diagramType, showToast, pendingRevisionLabel, saving]);

  const handleChatSubmit = useCallback((_e?: React.FormEvent<HTMLFormElement> | React.KeyboardEvent) => {
    if (!input.trim() || aiLoading) return;
    setAiError(null);
    const text = input;
    setInput("");
    sendChatMessage(text);
  }, [input, aiLoading, sendChatMessage]);

  const handleUseCaseChange = useCallback((id: UseCaseId) => {
    setUseCaseId(id);
  }, []);

  // Apply agent tool results to editor state; record each outcome in toolEffects.
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant") return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = Array.isArray((lastMessage as { parts?: unknown[] }).parts) ? (lastMessage as { parts: unknown[] }).parts as any[] : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolParts = parts.filter((p: any) => typeof p?.type === "string" && p.type.startsWith("tool-"));
    if (toolParts.length === 0) return;

    const snapshotBeforeTools = sourceRef.current;
    let liveSource = sourceRef.current;
    let mutated = false;
    const effects: Record<string, { status: "applied" | "noop" | "error"; label: string; detail?: string }> = {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toolParts.forEach((tp: any) => {
      if (tp.state !== "output-available") return;
      const id: string = tp.toolCallId;
      if (toolEffects[id]) return; // already applied (idempotent)
      const result = tp.output;
      if (!result) return;
      if (!result.success) {
        effects[id] = { status: "error", label: "Output rejected", detail: typeof result.error === "string" ? result.error.slice(0, 80) : undefined };
        return;
      }
      const toolName: string = tp.toolName ?? String(tp.type).slice(5);

      if (toolName === "update_diagram" && result.sourceCode) {
        liveSource = result.sourceCode;
        mutated = true;
        setSource(result.sourceCode);
        effects[id] = { status: "applied", label: "Diagram updated" };
      } else if (toolName === "apply_patch" && typeof result.sourceCode === "string") {
        // Server already applied + validated (and possibly repaired) the patch.
        liveSource = result.sourceCode;
        mutated = true;
        setSource(result.sourceCode);
        effects[id] = { status: "applied", label: "Patch applied" };
      } else if (toolName === "apply_patch" && typeof result.find === "string") {
        const { source: next, replaced } = applyPatch(liveSource, result.find, result.replace ?? "");
        if (replaced === 0) {
          effects[id] = { status: "noop", label: "Couldn't find that text", detail: result.find.slice(0, 60) };
        } else if (!isValidJson(next)) {
          effects[id] = { status: "error", label: "Patch would break the diagram", detail: "result was not valid JSON" };
        } else {
          liveSource = next;
          mutated = true;
          setSource(next);
          effects[id] = { status: "applied", label: `Replaced ${replaced} occurrence${replaced === 1 ? "" : "s"}` };
        }
      } else if (toolName === "apply_ops" && typeof result.sourceCode === "string") {
        liveSource = result.sourceCode;
        mutated = true;
        setSource(result.sourceCode);
        effects[id] = { status: "applied", label: `Applied ${result.applied} op${result.applied === 1 ? "" : "s"}` };
      } else if (toolName === "set_title" && result.title) {
        setTitle(result.title);
        effects[id] = { status: "applied", label: `Renamed to "${result.title}"` };
      } else if (toolName === "set_theme" && result.themeId) {
        setThemeId(result.themeId);
        effects[id] = { status: "applied", label: `Theme → ${result.themeId}` };
      } else if (toolName === "set_palette" && result.paletteId) {
        setPaletteId(result.paletteId);
        effects[id] = { status: "applied", label: `Palette → ${result.paletteId}` };
      } else if (toolName === "set_use_case" && result.useCaseId) {
        handleUseCaseChange(result.useCaseId);
        effects[id] = { status: "applied", label: `Use case → ${result.useCaseId}` };
      } else if (toolName === "apply_brand_kit") {
        if (!brandKitInFlight.current.has(id)) {
          brandKitInFlight.current.add(id);
          void handleApplyBrandKit().then((ok) => {
            setToolEffects((prev) => ({ ...prev, [id]: ok ? { status: "applied", label: "Applied brand kit" } : { status: "error", label: "No brand kit set" } }));
          });
        }
      }
    });

    if (Object.keys(effects).length > 0) {
      setToolEffects((prev) => ({ ...prev, ...effects }));
    }
    if (mutated) {
      setUndoStack((prev) => {
        if (prev[prev.length - 1] === snapshotBeforeTools) return prev;
        return [...prev.slice(-(UNDO_LIMIT - 1)), snapshotBeforeTools];
      });
      setRedoStack([]);
    }
  }, [messages, diagramType, toolEffects, handleUseCaseChange, handleApplyBrandKit]);

  const downloadBlob = (blob: Blob, name: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Fetch revisions when history opens or after a save/restore mutates them
  useEffect(() => {
    if (!historyOpen || !currentProjectId) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await listRevisions(currentProjectId);
        if (!cancelled) setRevisions(rows.map((r) => ({ ...r, createdAt: new Date(r.createdAt) })));
      } catch (e) {
        console.error("[revisions]", e);
      }
    })();
    return () => { cancelled = true; };
  }, [historyOpen, currentProjectId, revisionsDirty]);

  useClickOutside(historyRef, historyOpen, () => setHistoryOpen(false));
  useClickOutside(navRef, isNavMenuOpen, () => setIsNavMenuOpen(false));

  const handleRestore = useCallback(async (revisionId: string) => {
    if (!currentProjectId) return;
    setRestoringId(revisionId);
    try {
      const { source: restored } = await restoreRevision(currentProjectId, revisionId);
      recordUndo(source);
      setSource(restored);
      setRevisionsDirty((v) => v + 1);
      showToast("Revision restored · ⌘Z to undo");
      setHistoryOpen(false);
    } catch (e) {
      console.error("[restore]", e);
      showToast("Could not restore revision");
    } finally {
      setRestoringId(null);
    }
  }, [currentProjectId, source, recordUndo, showToast]);

  const pngDataUrlToJpeg = (pngDataUrl: string, quality: number, backgroundColor: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("2d context unavailable")); return; }
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("image load failed"));
      img.src = pngDataUrl;
    });

  const capturePngDataUrl = useCallback(async (): Promise<string | null> => {
    const node = frameRef.current;
    if (!node) return null;
    return await toPng(node, { pixelRatio: pngScale, filter: (n) => !(n as HTMLElement).hasAttribute?.("data-no-export") });
  }, [pngScale]);

  const handleExport = useCallback(async (format: "png" | "svg" | "pdf") => {
    setIsExporting(true);
    try {
      const fn = title || "diagram";
      if (format === "pdf") {
        const du = await capturePngDataUrl();
        if (!du) return;
        // Embedding the raw lossless PNG made PDFs ~10MB at scale 2. JPEG-encode
        // instead — visually indistinguishable at 0.85 quality, a fraction of
        // the size. JPEG has no alpha channel, so flatten transparent PNGs onto
        // the diagram's own background color first (otherwise transparent areas
        // render solid black).
        const jpegDu = await pngDataUrlToJpeg(du, 0.85, "#ffffff");
        const { jsPDF } = await import("jspdf");
        const img = new Image();
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("image load failed")); img.src = jpegDu; });
        const w = img.naturalWidth || 1920;
        const h = img.naturalHeight || 1080;
        const pdf = new jsPDF({ orientation: w >= h ? "landscape" : "portrait", unit: "px", format: [w, h] });
        pdf.addImage(jpegDu, "JPEG", 0, 0, w, h);
        downloadBlob(pdf.output("blob"), `${fn}.pdf`);
        return;
      }
      const node = frameRef.current;
      if (!node) return;
      if (format === "png") {
        const du = await toPng(node, { pixelRatio: pngScale, filter: (n) => !(n as HTMLElement).hasAttribute?.("data-no-export") });
        downloadBlob(await (await fetch(du)).blob(), `${fn}.png`);
      } else if (format === "svg") {
        const s = await toSvg(node, { filter: (n) => !(n as HTMLElement).hasAttribute?.("data-no-export") });
        downloadBlob(await (await fetch(s)).blob(), `${fn}.svg`);
      }
    } finally {
      setIsExporting(false);
    }
  }, [title, pngScale, capturePngDataUrl]);

  const handleCopyImage = useCallback(async () => {
    setIsExporting(true);
    try {
      let dataUrl: string | undefined;
      if (frameRef.current) {
        dataUrl = await toPng(frameRef.current, { pixelRatio: pngScale, filter: (n) => !(n as HTMLElement).hasAttribute?.("data-no-export") });
      }
      if (!dataUrl) return;
      const [, b64] = dataUrl.split(",");
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "image/png" });
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      showToast("Image copied — paste it anywhere");
    } catch {
      showToast("Copy failed — try Export PNG instead");
    } finally {
      setIsExporting(false);
    }
  }, [pngScale, showToast]);

  const handleCopySource = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(source);
      showToast("Source copied to clipboard");
    } catch {
      showToast("Copy failed — try Download instead");
    }
  }, [source, showToast]);

  const handleCopyReactCode = useCallback(async () => {
    try {
      if (diagramType !== "freeform") return;
      const { parseFreeformSource } = await import("@/lib/diagrams/freeform-canvas");
      const { exportFreeformToReact } = await import("@/lib/diagrams/freeform-to-react");
      const parsed = parseFreeformSource(source);
      const reactCode = exportFreeformToReact(parsed.doc);
      await navigator.clipboard.writeText(reactCode);
      showToast("React code copied to clipboard");
    } catch (e) {
      console.error(e);
      showToast("Failed to compile React code");
    }
  }, [diagramType, source, showToast]);

  /**
   * Capture a 1200x630 PNG of the current diagram for OG previews. Best-effort:
   * returns undefined on any failure so the OG route falls back to the
   * branded card.
   */
  const captureSharePreview = useCallback(async (): Promise<string | undefined> => {
    try {
      const node = frameRef.current;
      if (!node) return undefined;
      const rect = node.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return undefined;
      // Render at OG-card aspect (~1.91:1). Scale to keep file size reasonable.
      const targetWidth = 1200;
      const pixelRatio = Math.min(2, Math.max(1, targetWidth / Math.max(rect.width, 1)));
      const dataUrl = await toPng(node, {
        pixelRatio,
        backgroundColor: bgColor,
        filter: (n) => !(n as HTMLElement).hasAttribute?.("data-no-export"),
        cacheBust: true,
      });
      // Drop if it's too large to store (server enforces this too).
      if (dataUrl.length > 380_000) return undefined;
      return dataUrl;
    } catch (e) {
      console.warn("[share-preview]", e);
      return undefined;
    }
  }, [bgColor]);

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    try {
      let id = currentProjectId;
      if (!id) {
        id = await createProject(title || "Untitled", sourceWithUi, themeId, diagramType);
        setCurrentProjectId(id);
      } else {
        await saveProject(id, { source: sourceWithUi, themeId, title, diagramType });
      }
      const preview = await captureSharePreview();
      const token = await createShareLink(id, preview);
      await navigator.clipboard.writeText(`${window.location.origin}/s/${encodeURIComponent(token)}`);
      showToast(preview ? "Share link copied · preview attached" : "Share link copied!");
    } finally {
      setIsSharing(false);
    }
  }, [currentProjectId, sourceWithUi, themeId, title, diagramType, captureSharePreview, showToast]);

  const handleCopyEmbed = useCallback(async () => {
    setIsSharing(true);
    try {
      let id = currentProjectId;
      if (!id) {
        id = await createProject(title || "Untitled", sourceWithUi, themeId, diagramType);
        setCurrentProjectId(id);
      } else {
        await saveProject(id, { source: sourceWithUi, themeId, title, diagramType });
      }
      const preview = await captureSharePreview();
      const token = await createShareLink(id, preview);
      const url = `${window.location.origin}/embed/${encodeURIComponent(token)}`;
      const snippet = `<iframe src="${url}" width="800" height="500" frameborder="0" style="border:1px solid #e2e8f0;border-radius:8px" allowfullscreen></iframe>`;
      await navigator.clipboard.writeText(snippet);
      showToast("Embed code copied!");
    } finally {
      setIsSharing(false);
    }
  }, [currentProjectId, sourceWithUi, themeId, title, diagramType, captureSharePreview, showToast]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void handleSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        setLeftPanelOpen((p) => !p);
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave, openSearch]);

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const commandPaletteActions: CommandPaletteAction[] = useMemo(
    () => [
      {
        id: "apply-brand-kit",
        label: "Apply brand kit",
        hint: "Colors",
        icon: <Palette className="h-4 w-4" />,
        run: () => void handleApplyBrandKit(),
      },
      {
        id: "version-history",
        label: "Open version history",
        hint: "History",
        icon: <Clock className="h-4 w-4" />,
        run: () => setHistoryOpen(true),
      },
      {
        id: "browse-templates",
        label: "Browse templates",
        hint: "Gallery",
        icon: <LayoutTemplate className="h-4 w-4" />,
        run: () => router.push("/app/templates"),
      },
      {
        id: "toggle-dark-mode",
        label: darkMode ? "Switch to light mode" : "Switch to dark mode",
        hint: "Theme",
        icon: darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />,
        run: () => setDarkMode((v) => !v),
      },
      {
        id: "toggle-agent-mode",
        label: isAgentMode ? "Turn off Agent mode" : "Turn on Agent mode",
        hint: "AI",
        icon: <Bot className="h-4 w-4" />,
        run: () => setIsAgentMode((v) => !v),
      },
      {
        id: "toggle-compact-ai-context",
        label: compactAiContext ? "Send full diagram context to AI" : "Send less diagram context to AI",
        hint: compactAiContext ? "Compact: on" : "Compact: off",
        icon: <Zap className="h-4 w-4" />,
        run: () => setCompactAiContext((v) => !v),
      },
    ],
    [diagramType, darkMode, isAgentMode, router, handleApplyBrandKit, compactAiContext]
  );

  const EDIT_CHIPS = ["Change colors", "Add a step", "Simplify", "Add labels", "Fix layout"];

  const QUICK_PROMPTS: Partial<Record<DiagramType, string[]>> = {
    freeform: ["Add shapes", "Create a wireframe", "Add text labels"],
  };

  const sourceLabel = "JSON Source";

  return (
    <div className={`flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-white${darkMode ? " dark" : ""}`}>
      {/* GLOBAL TOP HEADER */}
      <header className="shrink-0 flex items-center justify-between px-4 py-1.5 z-50" style={{ background: "var(--cream)", borderBottom: "1.5px solid var(--fs-border)", height: 52 }}>
        {/* Left: Logo & Dropdown */}
        <div ref={navRef} className="flex items-center gap-3 relative">
          <button
            onClick={() => setIsNavMenuOpen(!isNavMenuOpen)}
            className="flex items-center gap-1.5 transition-colors p-1 rounded fs-btn-press"
            style={{ fontFamily: "var(--font-mono-fs)", fontSize: 13, color: "var(--charcoal)" }}
          >
            <Logo className="h-5 w-5 shadow-xs rounded-sm shadow-orange-500/20" />
            <span style={{ fontFamily: "var(--font-mono-fs)", fontWeight: 500, color: "var(--charcoal)" }}>{title || "drawxyz"}</span>
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </button>

          {isNavMenuOpen && (
            <div className="absolute top-full left-0 mt-1 w-48 rounded-xl border border-slate-200 bg-white shadow-lg z-100 py-1 text-sm">
              <Link href="/" className="block px-4 py-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900">Home</Link>
              <Link href="/app" className="block px-4 py-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900">Projects</Link>
              <Link href="/app/settings" className="block px-4 py-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900">Settings</Link>
              <div className="h-px bg-slate-100 my-1" />
              <button className="block w-full text-left px-4 py-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900">Change Logo</button>
            </div>
          )}

          <div className="flex items-center gap-1">
             <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                <div className="h-4 w-4 border-2 border-slate-300 rounded-full border-t-transparent animate-spin-slow" title="History" />
             </button>
          </div>
          {/* Save status */}
          <span style={{ fontFamily: "var(--font-mono-fs)", fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}>
            {saveState === "saving" && (
              <>
                <span className="fs-spin" style={{ width: 11, height: 11, border: "2px solid rgba(79,70,229,0.2)", borderTopColor: "var(--fs-indigo)", borderRadius: "50%", display: "inline-block" }} />
                <span style={{ color: "#999" }}>Saving…</span>
              </>
            )}
            {saveState === "saved" && (
              <span style={{ color: "#22C55E" }}>· Saved</span>
            )}
            {saveState === "unsaved" && (
              <>
                <span className="fs-pulse-dot" style={{ width: 6, height: 6, background: "var(--fs-indigo)", borderRadius: "50%", display: "inline-block" }} />
                <span style={{ color: "#999" }}>Unsaved</span>
              </>
            )}
          </span>
        </div>

        {/* Center: Preview/Code toggle */}
        <div className="absolute left-1/2 -translate-x-1/2 hidden sm:flex items-center gap-0.5" style={{ background: "#F3F4F6", padding: 4, borderRadius: 4 }}>
           <button
             onClick={() => setSourceExpanded(false)}
             className="flex items-center gap-1.5 fs-btn-press"
             style={{
               fontFamily: "var(--font-mono-fs)", fontSize: 12, padding: "5px 14px", borderRadius: 3,
               background: !sourceExpanded ? "white" : "transparent",
               color: !sourceExpanded ? "var(--charcoal)" : "#6B7280",
               boxShadow: !sourceExpanded ? "0 1px 3px rgba(0,0,0,0.07)" : "none",
               border: "none", cursor: "pointer",
             }}
           >
              <Play className="h-3 w-3" /> Preview
           </button>
           <button
             onClick={() => setSourceExpanded(true)}
             className="flex items-center gap-1.5 fs-btn-press"
             style={{
               fontFamily: "var(--font-mono-fs)", fontSize: 12, padding: "5px 14px", borderRadius: 3,
               background: sourceExpanded ? "white" : "transparent",
               color: sourceExpanded ? "var(--charcoal)" : "#6B7280",
               boxShadow: sourceExpanded ? "0 1px 3px rgba(0,0,0,0.07)" : "none",
               border: "none", cursor: "pointer",
             }}
           >
              <Code2 className="h-3 w-3" /> Code
           </button>
        </div>

        {/* Right: Share, Publish, Presence avatars, User avatar */}
        <div className="flex items-center gap-2">
           <button
             onClick={() => void handleShare()}
             disabled={isSharing}
             className="hidden sm:flex items-center gap-2 disabled:opacity-60 fs-btn-press"
             style={{ fontFamily: "var(--font-mono-fs)", fontSize: 12, color: "var(--charcoal)", background: "transparent", border: "1.5px solid var(--fs-border)", padding: "6px 12px", borderRadius: 2, cursor: "pointer" }}
           >
             <Share2 className="h-3 w-3" /> {isSharing ? "Sharing…" : "Share"}
           </button>
           <button
             onClick={() => void handleCopyEmbed()}
             disabled={isSharing}
             title="Copy <iframe> embed code"
             className="hidden sm:flex items-center gap-2 disabled:opacity-60 fs-btn-press"
             style={{ fontFamily: "var(--font-mono-fs)", fontSize: 12, color: "var(--charcoal)", background: "transparent", border: "1.5px solid var(--fs-border)", padding: "6px 12px", borderRadius: 2, cursor: "pointer" }}
           >
             <Code2 className="h-3 w-3" /> Embed
           </button>
           <button
             onClick={() => void handleShare()}
             disabled={isSharing}
             className="flex items-center gap-2 disabled:opacity-60 fs-btn-press"
             style={{ fontFamily: "var(--font-mono-fs)", fontSize: 12, color: "white", background: "var(--charcoal)", border: "1.5px solid var(--charcoal)", padding: "6px 12px", borderRadius: 2, cursor: "pointer" }}
           >
             Publish ↗
           </button>
           <button
             type="button"
             onClick={() => setCommandPaletteOpen(true)}
             className="flex items-center gap-1 fs-btn-press"
             style={{ fontFamily: "var(--font-mono-fs)", fontSize: 11, color: "var(--charcoal-light)", background: "transparent", border: "1px solid var(--fs-border)", padding: "5px 8px", borderRadius: 4, cursor: "pointer" }}
             title="Command palette"
           >
             <Command className="h-3 w-3" /> K
           </button>
           {presenceOthers.length > 0 && (
             <div className="flex items-center" style={{ marginLeft: 4 }}>
               {presenceOthers.slice(0, 4).map((u) => (
                 <div
                   key={u.email}
                   title={u.name || u.email}
                   className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-white -ml-2 first:ml-0 cursor-default shadow-xs"
                   style={{ background: presenceColor(u.email) }}
                 >
                   {(u.name || u.email).charAt(0).toUpperCase()}
                 </div>
               ))}
               {presenceOthers.length > 4 && (
                 <div className="h-7 w-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold border-2 border-white -ml-2 shadow-xs">
                   +{presenceOthers.length - 4}
                 </div>
               )}
             </div>
           )}
           <div className="h-7 w-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold ml-2 cursor-pointer border border-indigo-200" title={userName}>
             {(userName || userEmail || "U").charAt(0).toUpperCase()}
           </div>
        </div>
      </header>

      <div className="relative flex min-h-0 w-full flex-1 flex-row overflow-hidden dark:bg-slate-950" style={{ background: "var(--cream-dark)" }}>
        <Group
          orientation="horizontal"
          className="flex min-h-0 w-full flex-1 flex-row"
          onLayoutChanged={handleChatGroupLayoutChanged}
        >
          <Panel
            id="ai-chat"
            panelRef={chatPanelRef}
            collapsible
            collapsedSize={0}
            minSize={240}
            maxSize={480}
            defaultSize={280}
            className="relative z-40 flex flex-col overflow-hidden"
            style={{ background: "var(--cream)", borderRight: leftPanelOpen ? "1.5px solid var(--fs-border)" : "none" }}
          >
            {leftPanelOpen && (
              <div className="h-full w-full flex flex-col overflow-hidden">
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--fs-border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono-fs)", fontSize: 11, color: "var(--charcoal)", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
                    <span className="fs-pulse-dot" style={{ width: 6, height: 6, background: "#22C55E", borderRadius: "50%", display: "inline-block" }} />
                    AI Chat
                  </div>
                  <button
                    type="button"
                    onClick={() => setLeftPanelOpen(false)}
                    style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, cursor: "pointer", color: "#999", border: "none", background: "transparent", fontSize: 14 }}
                    title="Collapse panel"
                  >
                    ←
                  </button>
                </div>

          {/* AI Progress — driven by real server-side phase events (data-progress),
              not a client-authored fake step list. While status is "submitted"
              there is genuinely nothing to report yet but the intent-analysis
              call in flight, so that's exactly what this says. */}
          {aiLoading && (
            <div className="shrink-0 border-b border-white/5 bg-indigo-500/5 dark:bg-indigo-500/10 px-5 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400">
                  {isAgentMode ? "Agent" : "AI"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {progressPart?.status === "error" ? (
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                ) : progressPart?.status === "done" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                )}
                <span className="text-xs text-white font-medium">
                  {progressPart?.label ?? "Analyzing your request…"}
                </span>
              </div>
            </div>
          )}

          {/* Live model reasoning, when the selected model produces it (e.g.
              extended-thinking Claude, Gemini thinking). Not synthesized —
              this is the actual "reasoning" part AI SDK streams from the model,
              forwarded via sendReasoning on the agent route. */}
          {isAgentMode && aiLoading && (() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const parts: any[] = lastMessage && Array.isArray((lastMessage as { parts?: unknown[] }).parts)
              ? (lastMessage as { parts: any[] }).parts
              : [];
            const reasoningText = parts.filter((p) => p?.type === "reasoning").map((p) => p.text).join("").trim();
            if (!reasoningText) return null;
            return (
              <div className="shrink-0 border-b border-white/5 bg-slate-500/5 dark:bg-slate-500/10 px-5 py-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1.5">Thinking</div>
                <p className="text-xs italic text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                  {reasoningText.slice(-600)}
                </p>
              </div>
            );
          })()}

          {/* Chat History */}
          <div ref={chatListRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4 no-scrollbar">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center px-4">
                <div style={{ width: 44, height: 44, background: "#EEF2FF", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, fontSize: 22, flexShrink: 0 }}>✦</div>
                <div style={{ fontFamily: "var(--font-mono-fs)", fontSize: 13, color: "var(--charcoal)", marginBottom: 6 }}>How can I help you build?</div>
                <div style={{ fontFamily: "var(--font-sans-fs)", fontSize: 12, color: "#999", lineHeight: 1.5, fontWeight: 300 }}>
                  Describe the sketch, whiteboard, or spatial map you want to create.
                </div>
              </div>
            )}
            
            {messages.map((msg, i) => (
              <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className="relative max-w-[92%] px-3 py-2 text-[13px] leading-relaxed"
                  style={msg.role === "user"
                    ? { background: "var(--charcoal)", color: "white", borderRadius: 4, fontFamily: "var(--font-sans-fs)" }
                    : { background: "white", border: "1px solid var(--fs-border)", borderRadius: 4, color: "var(--charcoal-mid)", fontFamily: "var(--font-sans-fs)" }
                  }
                >
                  {(() => {
                    const raw = getMessageText(msg);
                    // Strip a leading ```json/```xml-style fence before checking —
                    // otherwise "```json\n{...}" starts with a backtick, not "{",
                    // and slips past the structured-source check below.
                    const withoutFence = raw.trim().replace(/^```[a-z]*\n?/i, "").trim();
                    // Non-mermaid diagram types stream raw JSON/XML source as
                    // the model's "reply" text — that's the diagram source,
                    // not a chat message, and shouldn't be dumped verbatim
                    // into the transcript. The real natural-language summary
                    // (aiNotice, shown above the canvas) is what belongs here.
                    const looksLikeStructuredSource =
                      withoutFence.length > 40 &&
                      (withoutFence.startsWith("{") || withoutFence.startsWith("[") || withoutFence.startsWith("<"));
                    const isStreamingThisMessage = msg.role === "assistant" && i === messages.length - 1 && aiLoading;
                    if (!looksLikeStructuredSource) {
                      return (
                        <>
                          {raw}
                          {isStreamingThisMessage && (
                            <span className="fs-cursor" style={{ display: "inline-block", width: 2, height: 14, background: "var(--fs-indigo)", marginLeft: 2, verticalAlign: "middle" }} />
                          )}
                        </>
                      );
                    }
                    if (!isStreamingThisMessage) return "✓ Diagram updated.";
                    // A JSON/XML diagram can't render partial/invalid mid-stream —
                    // unlike Mermaid, there's no meaningful "growing" text to show,
                    // so a few bounce dots stand in for a progress cue instead of
                    // a static line that reads as stalled.
                    return (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        Working on your diagram
                        <span style={{ display: "inline-flex", gap: 3 }}>
                          {[0, 1, 2].map((i) => (
                            <span key={i} className="fs-bounce-dot" style={{ width: 4, height: 4, background: "var(--fs-indigo)", borderRadius: "50%", display: "inline-block", animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </span>
                      </span>
                    );
                  })()}
                </div>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(Array.isArray((msg as { parts?: unknown[] }).parts) ? ((msg as { parts: any[] }).parts as any[]) : [])
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  .filter((p: any) => typeof p?.type === "string" && p.type.startsWith("tool-"))
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  .map((tool: any) => {
                    const toolName: string = tool.toolName ?? String(tool.type).slice(5);
                    const isDone = tool.state === "output-available";
                    const effect = toolEffects[tool.toolCallId];
                    const verbs: Record<string, string> = {
                      update_diagram: "Updating diagram…",
                      apply_patch: "Patching…",
                      update_node: "Updating node…",
                      apply_ops: "Applying canvas ops…",
                      fetch_external_data: "Fetching data…",
                      set_title: "Renaming…",
                      set_theme: "Setting theme…",
                      set_palette: "Setting palette…",
                      apply_brand_kit: "Applying brand kit…",
                      set_use_case: "Setting use-case…",
                    };
                    const explanation: string | undefined = tool.output?.explanation;
                    const failed = effect?.status === "noop" || effect?.status === "error";
                    return (
                      <div key={tool.toolCallId} className="mt-2 w-full max-w-[92%] p-2.5 text-xs text-slate-500 flex flex-col gap-1.5" style={{ background: "white", border: "1px solid var(--fs-border)", borderRadius: 3 }}>
                        <div className="flex items-center gap-2">
                          {!isDone ? <Settings2 className="h-3.5 w-3.5 text-indigo-400 animate-spin" /> : failed ? <AlertCircle className="h-3.5 w-3.5 text-amber-500" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                          <span className="font-semibold">{isDone && effect ? effect.label : (verbs[toolName] ?? "Using tool…")}</span>
                        </div>
                        {explanation && <span className="pl-5 text-slate-400 dark:text-slate-500">{stripAiSlop(explanation)}</span>}
                        {effect?.detail && <span className="pl-5 font-mono text-slate-400 dark:text-slate-500">{effect.detail}</span>}
                      </div>
                    );
                  })}
                {msg.role === "assistant" && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 flex items-center gap-4 px-2 text-slate-400 dark:text-slate-500"
                  >
                    <button
                      onClick={handleUndo}
                      disabled={undoStack.length === 0}
                      title="Undo (⌘Z)"
                      className="hover:text-slate-600 transition-colors disabled:opacity-30"
                    >
                      <Undo className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => void handleShare()}
                      title="Share diagram"
                      className="hover:text-slate-600 transition-colors"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                )}
              </div>
            ))}
          </div>

          {/* 3-dot thinking indicator — before first token */}
          {aiLoading && (messages.length === 0 || messages[messages.length - 1]?.role === "user") && (
            <div className="flex items-start px-3 pb-2">
              <div style={{ display: "flex", gap: 5, padding: "8px 12px", background: "white", border: "1px solid var(--fs-border)", borderRadius: 4 }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="fs-bounce-dot" style={{ width: 5, height: 5, background: "var(--charcoal-light)", borderRadius: "50%", display: "inline-block", animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
          {/* AI error inline — cleared on next submit */}
          {aiError && !aiLoading && (
            <div className="mx-3 mb-2 flex items-start justify-between gap-2 rounded" style={{ background: "#FEF2F2", border: "1px solid #FECACA", padding: "8px 10px" }}>
              <span style={{ fontFamily: "var(--font-sans-fs)", fontSize: 12, color: "#991B1B", lineHeight: 1.4 }}>{aiError}</span>
              <button type="button" onClick={() => setAiError(null)} style={{ color: "#F87171", background: "none", border: "none", cursor: "pointer", fontSize: 14, lineHeight: 1, flexShrink: 0 }}>×</button>
            </div>
          )}

          {/* Prompt Area with Quick Prompts */}
          <div className="shrink-0 space-y-3" style={{ borderTop: "1px solid var(--fs-border)", padding: "10px 12px", background: "var(--cream)" }}>
            {messages.length > 0 && source.trim() && (() => {
              const chips = [...(QUICK_PROMPTS[diagramType] ?? []), ...EDIT_CHIPS].slice(0, 4);
              return chips.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {chips.map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => { if (!aiLoading) sendChatMessage(label); }}
                      disabled={aiLoading}
                      className="fs-btn-press"
                      style={{ fontFamily: "var(--font-mono-fs)", fontSize: 10.5, letterSpacing: "0.02em", padding: "5px 12px", border: "1px solid #C7D2FE", borderRadius: 999, background: "#EEF2FF", color: "#4338CA", cursor: aiLoading ? "default" : "pointer", opacity: aiLoading ? 0.5 : 1 }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              );
            })()}
            
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleChatSubmit(e);
              }}
              className="relative flex flex-col"
              style={{ border: "1.5px solid var(--fs-border)", borderRadius: 4, background: "white", overflow: "hidden" }}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="How should I change the diagram?"
                className="w-full resize-none bg-transparent px-3 py-2.5 placeholder:text-slate-400 focus:outline-none"
                style={{ fontFamily: "var(--font-sans-fs)", fontSize: 13, color: "var(--charcoal)", border: "none", minHeight: 56 }}
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSubmit(e);
                  }
                }}
              />
              <div className="flex items-center justify-between" style={{ padding: "5px 8px", borderTop: "1px solid #F0EDE8" }}>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsAgentMode(!isAgentMode)}
                    title="Agent takes multiple steps — edit, theme, fetch data — to build your diagram"
                    className="fs-btn-press"
                    style={{ fontFamily: "var(--font-mono-fs)", fontSize: 10, letterSpacing: "0.04em", padding: "3px 8px", border: "1px solid var(--fs-border)", borderRadius: 2, cursor: "pointer", background: isAgentMode ? "var(--charcoal)" : "transparent", color: isAgentMode ? "white" : "var(--charcoal-light)" }}
                  >
                    ⚡ Agent
                  </button>
                  {source.trim() && (
                    <button
                      type="button"
                      onClick={() => setForceCreateNext((v) => !v)}
                      title="Next message will regenerate the diagram from scratch instead of patching the existing one"
                      className="fs-btn-press"
                    style={{ fontFamily: "var(--font-mono-fs)", fontSize: 10, letterSpacing: "0.04em", padding: "3px 8px", border: "1px solid var(--fs-border)", borderRadius: 2, cursor: "pointer", background: forceCreateNext ? "#FEF3C7" : "transparent", color: forceCreateNext ? "#92400E" : "var(--charcoal-light)" }}
                    >
                      ↺ Regen
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={!input?.trim() || aiLoading}
                  className="flex items-center justify-center disabled:opacity-30 transition-all"
                  style={{ width: 26, height: 26, background: "var(--charcoal)", borderRadius: 4, color: "white", border: "none", cursor: "pointer", flexShrink: 0 }}
                >
                  {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />}
                </button>
              </div>
              {isAgentMode && (
                <p className="px-2 pb-1 text-[11px] text-slate-400 dark:text-slate-500">
                  Agent mode: the AI takes multiple steps — editing, theming, and fetching data — to build your diagram.
                </p>
              )}
            </form>
          </div>
          </div>
            )}
          </Panel>
          <Separator
            className="relative z-40 w-1 shrink-0 cursor-col-resize outline-none hover:bg-indigo-200 active:bg-indigo-400 dark:hover:bg-indigo-800 dark:active:bg-indigo-600"
            style={{ background: "var(--fs-border)" }}
          />
          <Panel id="editor-main" className="flex min-w-0 flex-1 flex-row" style={{ position: "relative" }}>

    {/* Floating "Ask AI" pill — shown only while the AI Chat panel is collapsed */}
    {!leftPanelOpen && (
      <div style={{ position: "absolute", left: 16, bottom: 64, zIndex: 45, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
        {showAiPopover && (
          <form
            onSubmit={(e) => { e.preventDefault(); handleChatSubmit(e); setShowAiPopover(false); }}
            style={{ width: 300, borderRadius: 18, background: "rgba(255,255,255,0.94)", backdropFilter: "blur(12px)", border: "1.5px solid var(--fs-border)", boxShadow: "0 12px 32px rgba(0,0,0,0.16)", padding: 10 }}
          >
            {/* Same underlying chat/message state as the expanded AI Chat panel — just a second, collapsed presentation */}
            {aiNotice && (
              <div style={{ marginBottom: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                <p style={{ margin: 0, fontFamily: "var(--font-sans-fs)", fontSize: 12, lineHeight: 1.4, color: "var(--charcoal)" }}>
                  {aiNotice}
                </p>
                {followUpSuggestions && followUpSuggestions.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {followUpSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => {
                          setFollowUpSuggestions(null);
                          sendChatMessage(suggestion);
                        }}
                        className="fs-btn-press"
                        style={{
                          borderRadius: 999, border: "1px solid #FDE68A", background: "#FFFBEB",
                          color: "#92400E", fontSize: 11, fontWeight: 500, padding: "4px 10px", cursor: "pointer",
                        }}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <textarea
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What should I change, or ask about this?"
              rows={2}
              style={{ width: "100%", resize: "none", border: "1px solid var(--fs-border)", borderRadius: 12, padding: "8px 10px", fontFamily: "var(--font-sans-fs)", fontSize: 13, color: "var(--charcoal)", outline: "none", boxSizing: "border-box" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleChatSubmit(e);
                  setShowAiPopover(false);
                }
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
              <button
                type="submit"
                disabled={!input?.trim() || aiLoading}
                className="flex items-center justify-center disabled:opacity-30"
                style={{ width: 26, height: 26, background: "var(--charcoal)", borderRadius: 999, color: "white", border: "none", cursor: "pointer" }}
              >
                {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />}
              </button>
            </div>
          </form>
        )}
        <button
          type="button"
          onClick={() => setShowAiPopover((v) => !v)}
          className="fs-btn-press"
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 999,
            background: "rgba(255,255,255,0.6)", backdropFilter: "blur(10px)", border: "1px solid var(--fs-border)",
            color: "var(--charcoal)", fontFamily: "var(--font-mono-fs)", fontSize: 12, letterSpacing: "0.04em",
            cursor: "pointer", boxShadow: "0 4px 14px rgba(0,0,0,0.10)",
          }}
        >
          <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--fs-indigo)" }} />
          Ask AI
        </button>
      </div>
    )}

    {/* Center/Right: Diagram Canvas */}
    <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
      {/* AI generation progress bar */}
      {aiLoading && (
        <div className="relative h-0.5 w-full shrink-0 overflow-hidden bg-indigo-100">
          <div className="ai-progress-bar" />
        </div>
      )}
      {/* AI notice banner — type switch, assumption info, or a clarifying question */}
      {aiNotice && (
        <div className="flex shrink-0 flex-col gap-1.5 border-b border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs text-indigo-700">
          <div className="flex items-center justify-between gap-2">
            <span>{aiNotice}</span>
            <button
              type="button"
              onClick={() => { setAiNotice(null); setClarificationOptions(null); setFollowUpSuggestions(null); }}
              className="rounded-sm p-0.5 hover:bg-indigo-100"
              aria-label="Dismiss notice"
            >×</button>
          </div>
          {clarificationOptions && clarificationOptions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {clarificationOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setAiNotice(null);
                    setClarificationOptions(null);
                    sendChatMessage(option);
                  }}
                  className="fs-btn-press rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                >
                  {option}
                </button>
              ))}
            </div>
          )}
          {followUpSuggestions && followUpSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {followUpSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setFollowUpSuggestions(null);
                    sendChatMessage(suggestion);
                  }}
                  className="fs-btn-press rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200 dark:hover:bg-amber-900"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {/* AI-05: assumption disclosure banner — "Generated as: type · preset · detail" */}
      {assumptionBanner && (
        <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
          <span className="truncate">{assumptionBanner}</span>
          <button
            type="button"
            onClick={() => setAssumptionBanner(null)}
            className="rounded-sm p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            aria-label="Dismiss generation notice"
          >×</button>
        </div>
      )}
      {missingPieces && missingPieces.length > 0 && (
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
          <span className="leading-snug">
            <span className="font-medium">Possibly missing:</span> your prompt implied {missingPieces.join(", ")}. Ask me to add anything that&apos;s not in the diagram.
          </span>
          <button
            type="button"
            onClick={() => setMissingPieces(null)}
            className="shrink-0 rounded-sm p-0.5 text-amber-400 hover:bg-amber-200 hover:text-amber-700 dark:hover:bg-amber-900 dark:hover:text-amber-200"
            aria-label="Dismiss missing-pieces notice"
          >×</button>
        </div>
      )}
      <div className="flex shrink-0 items-center gap-2 px-3 py-1 justify-between" style={{ background: darkMode ? "#0f172a" : "var(--cream)", borderBottom: "1px solid var(--fs-border)", height: 40 }}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLeftPanelOpen(!leftPanelOpen)}
            className="fs-btn-press"
            style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono-fs)", fontSize: 11, color: leftPanelOpen ? "var(--fs-indigo)" : "var(--charcoal-light)", padding: "4px 10px", borderRadius: 3, background: "transparent", border: "none", cursor: "pointer", letterSpacing: "0.02em" }}
            title="Toggle AI Panel (⌘B)"
          >
            ✦ AI Chat
          </button>
          <div style={{ width: 1, height: 20, background: "var(--fs-border)", flexShrink: 0 }} />
          <button
            type="button"
            onClick={() => setSourcePanelOpen(!sourcePanelOpen)}
            className="fs-btn-press"
            style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono-fs)", fontSize: 11, color: sourcePanelOpen ? "var(--fs-indigo)" : "var(--charcoal-light)", padding: "4px 10px", borderRadius: 3, background: "transparent", border: "none", cursor: "pointer", letterSpacing: "0.02em" }}
            title="Toggle Source editor"
          >
            {"</>"} Source
          </button>
            <div className="hidden lg:block h-4 w-px shrink-0" style={{ background: "var(--fs-border)" }} />
            <div className="hidden lg:flex shrink-0 items-center gap-1.5" style={{ fontFamily: "var(--font-mono-fs)", fontSize: 10, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--charcoal-light)" }}>
              <DiagramTypeIcon type={diagramType} size={10} />
              {typeMeta.label}
            </div>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {aiLoading && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--fs-indigo)", color: "white", padding: "3px 10px", borderRadius: 2, fontFamily: "var(--font-mono-fs)", fontSize: 10, letterSpacing: "0.04em" }}>
                <span className="fs-pulse-dot" style={{ width: 5, height: 5, background: "rgba(255,255,255,0.8)", borderRadius: "50%", display: "inline-block" }} />
                Streaming
              </span>
            )}
            {showWatermark && (
              <span style={{ fontFamily: "var(--font-mono-fs)", fontSize: 10, letterSpacing: "0.04em", background: "#FEF3C7", color: "#92400E", padding: "2px 7px", borderRadius: 2 }}>Free plan</span>
            )}
            
            <div className="hidden lg:flex items-center gap-1 border-r border-slate-200 dark:border-slate-700 pr-2 mr-1">
              <button
                type="button"
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                title="Undo (⌘Z)"
                className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Undo className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                title="Redo (⌘⇧Z)"
                className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Redo className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleApplyBrandKit()}
                disabled={applyingBrand}
                title="Apply your brand kit colors (manage in Settings)"
                className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Palette className="h-4 w-4" />
              </button>
              <div ref={historyRef} className="relative" data-history-menu-root>
                <button
                  type="button"
                  onClick={() => setHistoryOpen((v) => !v)}
                  disabled={!currentProjectId}
                  title={currentProjectId ? "Version history" : "Save first to see history"}
                  className="flex items-center gap-1 px-2 py-2 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-expanded={historyOpen}
                >
                  <Clock className="h-4 w-4" />
                  <ChevronDown className="h-3 w-3" />
                </button>
                {historyOpen && currentProjectId && (
                  <div className="absolute right-0 top-full mt-1 z-50 w-80 max-h-96 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
                    <div className="sticky top-0 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Version history
                    </div>
                    {revisions.length === 0 ? (
                      <div className="px-3 py-4 text-xs text-slate-400 dark:text-slate-500">Loading…</div>
                    ) : (
                      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {revisions.map((r) => (
                          <li key={r.id}>
                            <button
                              type="button"
                              onClick={() => handleRestore(r.id)}
                              disabled={restoringId === r.id}
                              className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                            >
                              <div className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                                {r.label ?? "Manual edit"}
                              </div>
                              <div className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                                {r.createdAt.toLocaleString()}
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setDarkMode((d) => !d)}
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <div ref={exportRef} className="relative" data-export-menu-root>
              <button
                type="button"
                onClick={() => setExportOpen((p) => !p)}
                disabled={isExporting}
                className="hidden sm:block px-4 py-1.5 bg-slate-900 text-white rounded-lg text-[13px] font-semibold hover:bg-slate-800 disabled:opacity-60 transition-colors shadow-xs"
                aria-expanded={exportOpen}
              >
                {isExporting ? "…" : "Export ▾"}
              </button>
              {exportOpen && (
                <div className="absolute right-0 top-full z-30 mt-1 w-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-lg">
                  <div className="mb-1.5">
                    <button type="button" onClick={() => void handleCopyImage()} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">Copy image</button>
                  </div>
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <button type="button" onClick={() => void handleCopySource()} className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">Copy source</button>
                    <button type="button" onClick={() => downloadSource(source, diagramType, title || "diagram")} className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">{`Download .${sourceFileExtension(diagramType)}`}</button>
                  </div>
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <button type="button" onClick={() => void handleCopyReactCode()} className="flex-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-2 text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50">Copy React Prototype</button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => void handleExport("png")} className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">PNG</button>
                    <button type="button" onClick={() => void handleExport("svg")} className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">SVG</button>
                    <button type="button" onClick={() => void handleExport("pdf")} className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">PDF</button>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1">
                      <label htmlFor="editor-export-scale" className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">PNG scale</label>
                      <select id="editor-export-scale" value={pngScale} onChange={(e) => setPngScale(Number(e.target.value) as 1 | 2 | 3)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2 py-1.5 text-xs">
                        <option value={1}>1×</option><option value={2}>2×</option><option value={3}>3×</option>
                      </select>
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] leading-snug text-slate-400">Native canvas export — custom sizes don&apos;t apply.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          className="fs-dot-grid flex min-h-0 flex-1 items-start justify-center overflow-auto p-3"
          style={{ position: "relative" }}
        >
          <div style={{ position: "absolute", top: 12, left: 12, zIndex: 10, fontFamily: "var(--font-mono-fs)", fontSize: 10, color: "#999", letterSpacing: "0.06em", textTransform: "uppercase", background: "white", border: "1px solid var(--fs-border)", padding: "4px 8px", borderRadius: 2, pointerEvents: "none" }}>
            {typeMeta.label}
          </div>
          <div ref={frameRef} className="w-full h-full rounded-xl overflow-hidden shadow-xl bg-white dark:bg-slate-900" style={{ minHeight: "600px" }}>
            <FreeformRenderer source={source} onChange={setSource} roomId={currentProjectId ?? undefined} />
            {showWatermark && <div className="absolute bottom-3 right-4 text-[10px] opacity-30 text-slate-600 font-medium select-none pointer-events-none">Made with drawxyz</div>}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {sourcePanelOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 380, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 220 }}
            className="relative z-30 flex flex-col overflow-hidden pr-4 py-3"
          >
            <div className="h-full w-[360px] flex flex-col rounded-2xl border border-slate-200/60 bg-white/95 backdrop-blur-xl shadow-2xl overflow-hidden dark:border-slate-700/60 dark:bg-slate-900/95">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Code2 className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Source</span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wide">{diagramType}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={openSearch}
                    className="rounded-sm p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    aria-label="Find in source (⌘F)"
                    title="Find (⌘F)"
                  >
                    <Search className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourcePanelOpen(false)}
                    className="rounded-sm p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    aria-label="Close source editor"
                  >
                    ×
                  </button>
                </div>
              </div>
              {searchOpen && (
                <div className="border-b border-slate-100 bg-slate-50/50 px-3 py-2 space-y-1.5 dark:border-slate-800 dark:bg-slate-800/50">
                  <div className="flex items-center gap-1.5">
                    <Search className="h-3 w-3 shrink-0 text-slate-400" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setSearchOpen(false);
                          sourceTextareaRef.current?.focus();
                          return;
                        }
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (searchMatches.length === 0) return;
                          focusMatch(searchActiveIdx + (e.shiftKey ? -1 : 1));
                        }
                      }}
                      placeholder="Find"
                      className="min-w-0 flex-1 rounded-sm border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-800 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-hidden focus:ring-1 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    />
                    <span className="shrink-0 text-[10px] tabular-nums text-slate-400 w-12 text-right">
                      {searchQuery
                        ? searchMatches.length === 0
                          ? "0/0"
                          : `${searchActiveIdx + 1}/${searchMatches.length}`
                        : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSearchCaseSensitive((v) => !v)}
                      title="Match case"
                      className={`shrink-0 rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold ${searchCaseSensitive ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"}`}
                    >
                      Aa
                    </button>
                    <button
                      type="button"
                      onClick={() => focusMatch(searchActiveIdx - 1)}
                      disabled={searchMatches.length === 0}
                      title="Previous match (⇧⏎)"
                      className="shrink-0 rounded-sm p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-700"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => focusMatch(searchActiveIdx + 1)}
                      disabled={searchMatches.length === 0}
                      title="Next match (⏎)"
                      className="shrink-0 rounded-sm p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 dark:hover:bg-slate-700"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setReplaceOpen((v) => !v)}
                      title="Toggle replace"
                      className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ${replaceOpen ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"}`}
                    >
                      ⇄
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchOpen(false);
                        sourceTextareaRef.current?.focus();
                      }}
                      title="Close (Esc)"
                      className="shrink-0 rounded-sm p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  {replaceOpen && (
                    <div className="flex items-center gap-1.5">
                      <span className="shrink-0 text-[10px] text-slate-400 w-3 text-center">↳</span>
                      <input
                        type="text"
                        value={replaceQuery}
                        onChange={(e) => setReplaceQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            replaceCurrent();
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            setSearchOpen(false);
                            sourceTextareaRef.current?.focus();
                          }
                        }}
                        placeholder="Replace"
                        className="min-w-0 flex-1 rounded-sm border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-800 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-hidden focus:ring-1 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      />
                      <button
                        type="button"
                        onClick={replaceCurrent}
                        disabled={searchMatches.length === 0}
                        title="Replace current"
                        className="shrink-0 rounded-sm border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={replaceAll}
                        disabled={searchMatches.length === 0}
                        title="Replace all matches"
                        className="shrink-0 rounded-sm border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        All
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div
                ref={sourceScrollRef}
                className="relative flex-1 overflow-auto"
                onScroll={(e) => {
                  const target = e.currentTarget;
                  const pre = target.querySelector("pre.hl-pre") as HTMLPreElement | null;
                  const gutter = target.querySelector("pre.hl-gutter") as HTMLPreElement | null;
                  if (pre) {
                    pre.style.transform = `translateX(${-target.scrollLeft}px)`;
                  }
                  if (gutter) {
                    gutter.style.transform = `translateX(${target.scrollLeft}px)`;
                  }
                }}
              >
                <pre
                  aria-hidden
                  className="hl-gutter pointer-events-none absolute left-0 top-0 z-10 m-0 w-10 select-none border-r border-slate-100 bg-slate-50/80 py-3 pr-2 text-right font-mono text-[11px] leading-relaxed text-slate-400 dark:border-slate-700 dark:bg-slate-800/80"
                >
                  {Array.from({ length: Math.max(1, source.split("\n").length) }, (_, i) => i + 1).join("\n")}
                </pre>
                <pre
                  aria-hidden
                  className="hl-pre pointer-events-none absolute left-10 top-0 m-0 w-[calc(100%-2.5rem)] whitespace-pre px-4 py-3 font-mono text-[12px] leading-relaxed text-slate-800 dark:text-slate-200"
                  dangerouslySetInnerHTML={{
                    __html: source ? highlightSource(source, diagramType) : "",
                  }}
                />
                <textarea
                  ref={sourceTextareaRef}
                  value={source}
                  onChange={(e) => {
                    recordUndo(source);
                    setSource(e.target.value);
                    setSourceCaret(caretFromOffset(e.target.value, e.target.selectionStart));
                  }}
                  onSelect={(e) => {
                    const ta = e.currentTarget;
                    setSourceCaret(caretFromOffset(ta.value, ta.selectionStart));
                  }}
                  onKeyDown={(e) => {
                    const ta = e.currentTarget;
                    const { selectionStart: start, selectionEnd: end, value } = ta;

                    if (e.key === "Tab") {
                      e.preventDefault();
                      if (!e.shiftKey && start === end) {
                        recordUndo(source);
                        const next = value.slice(0, start) + "  " + value.slice(end);
                        setSource(next);
                        requestAnimationFrame(() => {
                          ta.selectionStart = ta.selectionEnd = start + 2;
                          setSourceCaret(caretFromOffset(next, start + 2));
                        });
                        return;
                      }
                      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
                      const lineEnd = end < value.length && value[end] === "\n"
                        ? end
                        : value.indexOf("\n", end) === -1
                          ? value.length
                          : value.indexOf("\n", end);
                      const block = value.slice(lineStart, lineEnd);
                      const updated = e.shiftKey
                        ? block.replace(/^ {1,2}/gm, "")
                        : block.replace(/^/gm, "  ");
                      recordUndo(source);
                      const next = value.slice(0, lineStart) + updated + value.slice(lineEnd);
                      setSource(next);
                      const delta = updated.length - block.length;
                      requestAnimationFrame(() => {
                        ta.selectionStart = lineStart;
                        ta.selectionEnd = lineEnd + delta;
                        setSourceCaret(caretFromOffset(next, lineEnd + delta));
                      });
                      return;
                    }

                    if (e.key === "Backspace" && start === end && start > 0) {
                      const prev = value[start - 1];
                      const next = value[start];
                      if (prev && BRACKET_PAIRS[prev] === next) {
                        e.preventDefault();
                        recordUndo(source);
                        const updated = value.slice(0, start - 1) + value.slice(start + 1);
                        setSource(updated);
                        requestAnimationFrame(() => {
                          ta.selectionStart = ta.selectionEnd = start - 1;
                          setSourceCaret(caretFromOffset(updated, start - 1));
                        });
                        return;
                      }
                    }

                    if (BRACKET_CLOSERS.has(e.key) && start === end && value[start] === e.key) {
                      const prev = value[start - 1];
                      if (!(prev && BRACKET_OPENERS.has(prev) && BRACKET_PAIRS[prev] === e.key && (e.key === '"' || e.key === "'" || e.key === "`"))) {
                        e.preventDefault();
                        requestAnimationFrame(() => {
                          ta.selectionStart = ta.selectionEnd = start + 1;
                          setSourceCaret(caretFromOffset(value, start + 1));
                        });
                        return;
                      }
                    }

                    if (BRACKET_OPENERS.has(e.key)) {
                      const close = BRACKET_PAIRS[e.key];
                      if (start !== end) {
                        e.preventDefault();
                        recordUndo(source);
                        const selected = value.slice(start, end);
                        const updated = value.slice(0, start) + e.key + selected + close + value.slice(end);
                        setSource(updated);
                        requestAnimationFrame(() => {
                          ta.selectionStart = start + 1;
                          ta.selectionEnd = end + 1;
                          setSourceCaret(caretFromOffset(updated, end + 1));
                        });
                        return;
                      }
                      const nextChar = value[start] ?? "";
                      const canPair = nextChar === "" || /[\s)\]}>,;:]/.test(nextChar);
                      if (canPair) {
                        e.preventDefault();
                        recordUndo(source);
                        const updated = value.slice(0, start) + e.key + close + value.slice(end);
                        setSource(updated);
                        requestAnimationFrame(() => {
                          ta.selectionStart = ta.selectionEnd = start + 1;
                          setSourceCaret(caretFromOffset(updated, start + 1));
                        });
                        return;
                      }
                    }
                  }}
                  spellCheck={false}
                  wrap="off"
                  className="relative h-full w-full resize-none bg-transparent py-3 pr-4 pl-14 font-mono text-[12px] leading-relaxed text-transparent caret-slate-900 focus:outline-hidden dark:caret-slate-100"
                  style={{ minHeight: "100%" }}
                  placeholder="{}"
                />
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400 dark:border-slate-800">
                <span>⌘Z to undo · Changes apply live</span>
                <span className="tabular-nums">
                  Ln {sourceCaret.line}, Col {sourceCaret.col}
                </span>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
          </Panel>
        </Group>
      </div>

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        actions={commandPaletteActions}
      />

      {toast && (
        <div
          className="fs-toast-in"
          style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 9999,
            display: "flex", alignItems: "center", gap: 12,
            background: "white", border: "1px solid var(--fs-border)", borderRadius: 6,
            padding: "12px 16px", boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
            fontFamily: "var(--font-sans-fs)", fontSize: 13, color: "var(--charcoal)",
            minWidth: 240,
          }}
        >
          <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--fs-indigo-bg)", color: "var(--fs-indigo)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>✦</span>
          <span style={{ flex: 1 }}>{toast}</span>
          <button onClick={() => setToast(null)} style={{ color: "#9CA3AF", cursor: "pointer", background: "none", border: "none", fontSize: 14 }}>✕</button>
        </div>
      )}
    </div>
  );
}
