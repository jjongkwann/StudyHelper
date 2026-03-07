"use client";

import { useEffect, useState, useRef } from "react";
import { MessageSquareText } from "lucide-react";
import { AnnotationCard } from "./annotation-card";

interface Annotation {
  id: string;
  selectedText: string;
  note: string | null;
  color: string;
  createdAt: string;
}

interface AnnotationPanelProps {
  conceptId: string;
  refreshKey?: number;
}

export function AnnotationPanel({
  conceptId,
  refreshKey,
}: AnnotationPanelProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    fetch(`/api/annotations?conceptId=${conceptId}`, { signal: controller.signal })
      .then((res) => res.ok ? res.json() : [])
      .then(setAnnotations)
      .catch(() => {});

    return () => controller.abort();
  }, [conceptId, refreshKey]);

  useEffect(() => {
    if (refreshKey && refreshKey > 0) {
      const id = window.setTimeout(() => setIsOpen(true), 0);
      return () => window.clearTimeout(id);
    }
  }, [refreshKey]);

  const handleUpdate = async (id: string, data: { note?: string }) => {
    const res = await fetch(`/api/annotations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated = await res.json();
      setAnnotations((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...updated } : a))
      );
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/annotations/${id}`, { method: "DELETE" });
    if (res.ok) {
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
    }
  };

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
          {annotations.map((a) => (
            <AnnotationCard
              key={a.id}
              annotation={a}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}

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
