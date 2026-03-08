"use client";

import { useState } from "react";
import { Pencil, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";

interface AnnotationCardProps {
  annotation: {
    id: string;
    type: "highlight" | "memo";
    selectedText: string;
    note: string | null;
    color: string;
    createdAt: string;
  };
  onUpdate: (id: string, data: { note?: string | null }) => void | Promise<void>;
  onDelete: (id: string) => void;
  showOrigin?: boolean;
  originLink?: string;
}

const colorMap: Record<string, string> = {
  yellow: "border-l-yellow-400",
  blue: "border-l-blue-400",
  green: "border-l-green-400",
  pink: "border-l-pink-400",
};

const dotMap: Record<string, string> = {
  yellow: "bg-yellow-400",
  blue: "bg-blue-400",
  green: "bg-green-400",
  pink: "bg-pink-400",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
  });
}

export function AnnotationCard({
  annotation,
  onUpdate,
  onDelete,
  showOrigin,
  originLink,
}: AnnotationCardProps) {
  const [editing, setEditing] = useState(false);
  const [editNote, setEditNote] = useState(annotation.note ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = () => {
    onUpdate(annotation.id, { note: editNote.trim() || null });
    setEditing(false);
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete(annotation.id);
  };

  return (
    <div
      className={`rounded-lg border border-border/60 border-l-4 bg-card p-3 ${colorMap[annotation.color] || colorMap.yellow}`}
    >
      <div className="flex items-start gap-2">
        <div
          className={`mt-1.5 size-2 shrink-0 rounded-full ${dotMap[annotation.color] || dotMap.yellow}`}
        />
        <div className="min-w-0 flex-1">
          <blockquote className="text-sm italic text-muted-foreground leading-relaxed">
            &ldquo;{annotation.selectedText}&rdquo;
          </blockquote>

          <div className="mt-2">
            <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
              {annotation.type === "memo" ? "메모" : "형광펜"}
            </span>
          </div>

          {editing ? (
            <div className="mt-2 space-y-2">
              <Textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="메모를 입력하세요..."
                rows={2}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                  취소
                </Button>
                <Button size="sm" onClick={handleSave}>
                  저장
                </Button>
              </div>
            </div>
          ) : annotation.note ? (
            <p className="mt-2 text-sm">{annotation.note}</p>
          ) : null}

          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {timeAgo(annotation.createdAt)}
            </span>

            <div className="flex items-center gap-1">
              {showOrigin && originLink && (
                <Link href={originLink}>
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                    바로가기
                    <ExternalLink className="size-3" />
                  </Button>
                </Link>
              )}
              {annotation.type === "memo" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-7 p-0"
                  onClick={() => {
                    setEditing(true);
                    setEditNote(annotation.note ?? "");
                  }}
                >
                  <Pencil className="size-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className={`size-7 p-0 ${confirmDelete ? "text-destructive" : ""}`}
                onClick={handleDelete}
                onBlur={() => setConfirmDelete(false)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
