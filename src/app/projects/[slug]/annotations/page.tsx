"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { BookOpen, ArrowLeft, StickyNote, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnnotationCard } from "@/components/annotation-card";

interface AnnotationWithOrigin {
  id: string;
  type: "highlight" | "memo";
  selectedText: string;
  note: string | null;
  color: string;
  createdAt: string;
  concept: {
    id: string;
    title: string;
    order: number;
    chapter: {
      id: string;
      title: string;
      order: number;
    };
  };
}

type ColorFilter = "all" | "yellow" | "blue" | "green" | "pink";
type TypeFilter = "all" | "memo" | "highlight";
type SortOrder = "newest" | "oldest";

const colorOptions: { value: ColorFilter; label: string; bg: string }[] = [
  { value: "all", label: "전체", bg: "" },
  { value: "yellow", label: "노랑", bg: "bg-yellow-300" },
  { value: "blue", label: "파랑", bg: "bg-blue-300" },
  { value: "green", label: "초록", bg: "bg-green-300" },
  { value: "pink", label: "분홍", bg: "bg-pink-300" },
];

const typeOptions: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "memo", label: "메모만" },
  { value: "highlight", label: "형광펜만" },
];

export default function AnnotationsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [annotations, setAnnotations] = useState<AnnotationWithOrigin[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterChapter, setFilterChapter] = useState<string>("all");
  const [filterColor, setFilterColor] = useState<ColorFilter>("all");
  const [filterType, setFilterType] = useState<TypeFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  useEffect(() => {
    fetch(`/api/annotations?projectSlug=${slug}`)
      .then((r) => r.json())
      .then(setAnnotations)
      .finally(() => setLoading(false));
  }, [slug]);

  const chapters = useMemo(() => {
    const map = new Map<string, { id: string; title: string; order: number }>();
    for (const a of annotations) {
      if (!map.has(a.concept.chapter.id)) {
        map.set(a.concept.chapter.id, a.concept.chapter);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.order - b.order);
  }, [annotations]);

  const filtered = useMemo(() => {
    return annotations.filter((a) => {
      if (filterChapter !== "all" && a.concept.chapter.id !== filterChapter) return false;
      if (filterColor !== "all" && a.color !== filterColor) return false;
      if (filterType === "memo" && a.type !== "memo") return false;
      if (filterType === "highlight" && a.type !== "highlight") return false;
      return true;
    });
  }, [annotations, filterChapter, filterColor, filterType]);

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        chapter: { id: string; title: string; order: number };
        earliestCreatedAt: string;
        concepts: Map<
          string,
          {
            concept: { id: string; title: string; order: number };
            items: AnnotationWithOrigin[];
          }
        >;
      }
    >();

    for (const a of filtered) {
      const chKey = a.concept.chapter.id;
      if (!map.has(chKey)) {
        map.set(chKey, {
          chapter: a.concept.chapter,
          earliestCreatedAt: a.createdAt,
          concepts: new Map(),
        });
      }
      const chGroup = map.get(chKey)!;
      // Track earliest/latest for group sorting
      if (sortOrder === "newest") {
        if (a.createdAt > chGroup.earliestCreatedAt) chGroup.earliestCreatedAt = a.createdAt;
      } else {
        if (a.createdAt < chGroup.earliestCreatedAt) chGroup.earliestCreatedAt = a.createdAt;
      }

      const coKey = a.concept.id;
      if (!chGroup.concepts.has(coKey)) {
        chGroup.concepts.set(coKey, {
          concept: { id: a.concept.id, title: a.concept.title, order: a.concept.order },
          items: [],
        });
      }
      chGroup.concepts.get(coKey)!.items.push(a);
    }

    const sortFn = (a: string, b: string) =>
      sortOrder === "newest" ? b.localeCompare(a) : a.localeCompare(b);

    return Array.from(map.values())
      .sort((a, b) => sortFn(a.earliestCreatedAt, b.earliestCreatedAt))
      .map((ch) => ({
        chapter: ch.chapter,
        concepts: Array.from(ch.concepts.values())
          .map((co) => ({
            ...co,
            items: [...co.items].sort((a, b) => sortFn(a.createdAt, b.createdAt)),
          }))
          .sort((a, b) => {
            const aTime = a.items[0]?.createdAt ?? "";
            const bTime = b.items[0]?.createdAt ?? "";
            return sortFn(aTime, bTime);
          }),
      }));
  }, [filtered, sortOrder]);

  const handleUpdate = async (id: string, data: { note?: string | null }) => {
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

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  const hasActiveFilter = filterChapter !== "all" || filterColor !== "all" || filterType !== "all";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/projects/${slug}`}>
            <Button variant="ghost" size="sm" className="size-9 p-0">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <StickyNote className="size-5" />
              <h1 className="text-2xl font-bold">메모함</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasActiveFilter
                ? `총 ${annotations.length}개 중 ${filtered.length}개`
                : `총 ${annotations.length}개`}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-sm"
          onClick={() => setSortOrder((s) => (s === "newest" ? "oldest" : "newest"))}
        >
          <ArrowUpDown className="size-3.5" />
          {sortOrder === "newest" ? "최신순" : "오래된순"}
        </Button>
      </div>

      {/* Chapter filter */}
      {chapters.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filterChapter === "all" ? "default" : "outline"}
            size="sm"
            className="rounded-full"
            onClick={() => setFilterChapter("all")}
          >
            전체
          </Button>
          {chapters.map((ch) => (
            <Button
              key={ch.id}
              variant={filterChapter === ch.id ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => setFilterChapter(ch.id)}
            >
              Ch.{ch.order} {ch.title}
            </Button>
          ))}
        </div>
      )}

      {/* Color + Type filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5">
          {colorOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterColor(opt.value)}
              className={`flex size-7 items-center justify-center rounded-full border-2 text-xs transition-all ${
                filterColor === opt.value
                  ? "border-foreground scale-110"
                  : "border-transparent hover:border-muted-foreground/40"
              } ${opt.bg || "bg-muted"}`}
              title={opt.label}
            >
              {opt.value === "all" && <span className="text-muted-foreground">All</span>}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {typeOptions.map((opt) => (
            <Button
              key={opt.value}
              variant={filterType === opt.value ? "default" : "outline"}
              size="sm"
              className="h-7 rounded-full px-3 text-xs"
              onClick={() => setFilterType(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {annotations.length === 0 ? (
        <div className="py-16 text-center">
          <StickyNote className="mx-auto size-12 text-muted-foreground/30" />
          <p className="mt-4 text-muted-foreground">
            아직 하이라이트가 없습니다.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            학습 중에 텍스트를 선택해보세요!
          </p>
          <Link href={`/projects/${slug}/learn`} className="mt-4 inline-block">
            <Button variant="outline">
              <BookOpen className="size-4" />
              학습하러 가기
            </Button>
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">필터 조건에 맞는 항목이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map((chGroup) => (
            <section key={chGroup.chapter.id}>
              <div className="mb-4 flex items-center gap-2 border-b pb-2">
                <Badge variant="outline" className="rounded-full">
                  Chapter {chGroup.chapter.order}
                </Badge>
                <h2 className="font-semibold">{chGroup.chapter.title}</h2>
              </div>

              <div className="space-y-6">
                {chGroup.concepts.map((coGroup) => (
                  <div key={coGroup.concept.id}>
                    <Link
                      href={`/projects/${slug}/learn/${chGroup.chapter.id}?conceptId=${coGroup.concept.id}`}
                      className="mb-2 flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-primary"
                    >
                      <BookOpen className="size-3.5" />
                      {coGroup.concept.title}
                    </Link>
                    <div className="space-y-2 pl-5">
                      {coGroup.items.map((a) => (
                        <AnnotationCard
                          key={a.id}
                          annotation={a}
                          onUpdate={handleUpdate}
                          onDelete={handleDelete}
                          showOrigin
                          originLink={`/projects/${slug}/learn/${chGroup.chapter.id}?conceptId=${coGroup.concept.id}`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
