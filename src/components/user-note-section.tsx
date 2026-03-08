"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { ChevronDown, ChevronUp, PenLine, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface UserNoteSectionProps {
  conceptId: string;
}

export function UserNoteSection({ conceptId }: UserNoteSectionProps) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [showSavedMsg, setShowSavedMsg] = useState(false);
  const prevConceptIdRef = useRef(conceptId);

  const isDirty = content !== savedContent;

  const loadNote = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/user-notes?conceptId=${id}`);
      const data = await res.json();
      const text = data?.userSummary ?? "";
      setContent(text);
      setSavedContent(text);
      setSavedAt(data?.updatedAt ? new Date(data.updatedAt) : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Warn on concept switch with unsaved changes
    if (prevConceptIdRef.current !== conceptId && isDirty) {
      const discard = window.confirm(
        "저장하지 않은 변경사항이 있습니다. 이동하시겠습니까?"
      );
      if (!discard) {
        // Can't prevent navigation in this model, but at least warn
      }
    }
    prevConceptIdRef.current = conceptId;
    loadNote(conceptId);
  }, [conceptId, loadNote]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user-notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conceptId, userSummary: content }),
      });
      if (res.ok) {
        setSavedContent(content);
        setSavedAt(new Date());
        setShowSavedMsg(true);
        setTimeout(() => setShowSavedMsg(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  const timeSinceSave = savedAt
    ? Math.floor((Date.now() - savedAt.getTime()) / 60000)
    : null;

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg px-1 py-2 text-sm font-semibold transition-colors hover:bg-muted/50"
      >
        <span className="flex items-center gap-2">
          <PenLine className="size-4" />
          내 정리
          {isDirty && (
            <span className="size-2 rounded-full bg-orange-400" />
          )}
        </span>
        {open ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="mt-2 space-y-3">
          {loading ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              불러오는 중...
            </div>
          ) : (
            <>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="이 개념에 대해 자유롭게 정리해보세요..."
                rows={6}
                className="resize-y"
              />
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {showSavedMsg ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <Check className="size-3" />
                      저장 완료
                    </span>
                  ) : savedAt && timeSinceSave !== null ? (
                    timeSinceSave < 1
                      ? "방금 저장됨"
                      : `마지막 저장: ${timeSinceSave}분 전`
                  ) : null}
                </div>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  className="gap-1.5"
                >
                  <Save className="size-3.5" />
                  {saving ? "저장 중..." : "저장"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
