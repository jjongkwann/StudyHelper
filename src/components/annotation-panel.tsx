"use client";

import { useEffect, useState } from "react";
import { MessageSquareText } from "lucide-react";
import { AnnotationCard } from "./annotation-card";

interface Annotation {
  id: string;
  type: "highlight" | "memo";
  selectedText: string;
  note: string | null;
  color: string;
  createdAt: string;
}

interface AnnotationPanelProps {
  annotations: Annotation[];
  onUpdate: (id: string, data: { note?: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  refreshKey?: number;
}

export function AnnotationPanel({
  annotations,
  onUpdate,
  onDelete,
  refreshKey,
}: AnnotationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const highlights = annotations.filter((annotation) => annotation.type === "highlight");
  const memos = annotations.filter((annotation) => annotation.type === "memo");

  useEffect(() => {
    if (refreshKey && refreshKey > 0) {
      const id = window.setTimeout(() => setIsOpen(true), 0);
      return () => window.clearTimeout(id);
    }
  }, [refreshKey]);

  const count = annotations.length;

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center gap-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <MessageSquareText className="size-4" />
        <span>
          하이라이트 & 메모{count > 0 ? ` (${count})` : ""}
        </span>
      </button>

      {isOpen && (
        <div className="mt-2 space-y-3">
          {memos.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                메모
              </div>
              {memos.map((annotation) => (
                <AnnotationCard
                  key={annotation.id}
                  annotation={annotation}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}

          {highlights.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                형광펜
              </div>
              {highlights.map((annotation) => (
                <AnnotationCard
                  key={annotation.id}
                  annotation={annotation}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}

          {annotations.length === 0 && (
            <p className="py-3 text-center text-sm text-muted-foreground">
              아직 하이라이트가 없습니다. 텍스트를 선택해보세요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
