"use client";

import { useEffect, useState, useCallback, useRef, RefObject } from "react";
import { Highlighter, StickyNote, Copy, X } from "lucide-react";

interface SelectionToolbarProps {
  containerRef: RefObject<HTMLDivElement | null>;
  conceptId: string;
  onSaved: () => void;
}

export function SelectionToolbar({
  containerRef,
  conceptId,
  onSaved,
}: SelectionToolbarProps) {
  const [mode, _setMode] = useState<"hidden" | "toolbar" | "memo">("hidden");
  const modeRef = useRef(mode);
  const setMode = (next: "hidden" | "toolbar" | "memo") => {
    modeRef.current = next;
    _setMode(next);
  };

  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [selectedText, setSelectedText] = useState("");
  const [memoNote, setMemoNote] = useState("");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSelectionChange = useCallback(() => {
    // Always read latest mode from ref, not closure
    if (modeRef.current === "memo") return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !containerRef.current) {
      if (modeRef.current === "toolbar") setMode("hidden");
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      if (modeRef.current === "toolbar") setMode("hidden");
      return;
    }

    const range = selection.getRangeAt(0);
    if (!containerRef.current.contains(range.commonAncestorContainer)) {
      if (modeRef.current === "toolbar") setMode("hidden");
      return;
    }

    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    const toolbarHeight = 44;
    const toolbarHalfWidth = 100;

    let top = rect.top - containerRect.top - toolbarHeight;
    let left = rect.left - containerRect.left + rect.width / 2;

    if (top < 0) {
      top = rect.bottom - containerRect.top + 8;
    }
    left = Math.max(toolbarHalfWidth, Math.min(left, containerRect.width - toolbarHalfWidth));

    setSelectedText(text);
    setPosition({ top, left });
    setMode("toolbar");
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onPointerUp = () => {
      setTimeout(handleSelectionChange, 10);
    };

    container.addEventListener("mouseup", onPointerUp);
    container.addEventListener("touchend", onPointerUp);

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-selection-toolbar]")) return;
      setMode("hidden");
    };
    document.addEventListener("mousedown", onMouseDown);

    return () => {
      container.removeEventListener("mouseup", onPointerUp);
      container.removeEventListener("touchend", onPointerUp);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [containerRef, handleSelectionChange]);

  const dismiss = () => {
    window.getSelection()?.removeAllRanges();
    setMode("hidden");
    setMemoNote("");
  };

  const toggleHighlight = async () => {
    setSaving(true);
    try {
      // Check if same text already highlighted
      const listRes = await fetch(`/api/annotations?conceptId=${conceptId}`);
      const existing: { id: string; selectedText: string }[] = listRes.ok ? await listRes.json() : [];
      const match = existing.find((a) => a.selectedText === selectedText);

      if (match) {
        // Remove existing highlight
        await fetch(`/api/annotations/${match.id}`, { method: "DELETE" });
      } else {
        // Create new highlight
        await fetch("/api/annotations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conceptId, selectedText }),
        });
      }
      dismiss();
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const saveAnnotation = async (note?: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conceptId,
          selectedText,
          note: note?.trim() || undefined,
        }),
      });
      if (res.ok) {
        dismiss();
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleHighlight = () => toggleHighlight();

  const handleMemoOpen = () => {
    window.getSelection()?.removeAllRanges();
    setMemoNote("");
    setMode("memo");
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(selectedText);
    dismiss();
  };

  if (mode === "hidden") return null;

  return (
    <div
      data-selection-toolbar
      className="absolute z-50"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: "translateX(-50%)",
      }}
    >
      {mode === "toolbar" && (
        <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-popover px-1 py-1 shadow-lg">
          <button
            type="button"
            onClick={handleHighlight}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-yellow-100 hover:text-yellow-800"
          >
            <Highlighter className="size-3.5" />
            형광펜
          </button>
          <button
            type="button"
            onClick={handleMemoOpen}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-blue-100 hover:text-blue-800"
          >
            <StickyNote className="size-3.5" />
            메모
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
          >
            <Copy className="size-3.5" />
            복사
          </button>
        </div>
      )}

      {mode === "memo" && (
        <div className="w-72 rounded-xl border border-border/60 bg-popover p-3 shadow-xl sm:w-80">
          <div className="mb-2 flex items-start justify-between">
            <span className="text-xs font-medium text-muted-foreground">메모 추가</span>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <blockquote className="mb-3 line-clamp-3 border-l-2 border-yellow-400 pl-2.5 text-xs italic leading-relaxed text-muted-foreground">
            {selectedText}
          </blockquote>
          <textarea
            ref={textareaRef}
            value={memoNote}
            onChange={(e) => setMemoNote(e.target.value)}
            placeholder="메모를 입력하세요..."
            rows={3}
            className="mb-2 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={dismiss}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => saveAnnotation(memoNote)}
              disabled={saving}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
