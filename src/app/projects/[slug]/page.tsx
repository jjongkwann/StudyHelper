"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface ConceptInfo {
  id: string;
  title: string;
  bloomLevel: number;
  order: number;
  progress: {
    mastery: number;
    bloomLevelReached: number;
    easeFactor: number;
    nextReviewAt: string | null;
    consecutiveFails: number;
  } | null;
}

interface ChapterInfo {
  id: string;
  title: string;
  order: number;
  conceptCount: number;
  learnedConcepts: number;
  reviewDue: number;
  needsRelearning: number;
  progress: number;
  concepts: ConceptInfo[];
}

interface ProjectDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  chapters: ChapterInfo[];
}

const bloomLabels = ["", "기억", "이해", "적용", "분석", "평가", "창조"];
const bloomColors = [
  "",
  "bg-blue-100 text-blue-800",
  "bg-green-100 text-green-800",
  "bg-yellow-100 text-yellow-800",
  "bg-orange-100 text-orange-800",
  "bg-red-100 text-red-800",
  "bg-purple-100 text-purple-800",
];

export default function ProjectDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>(
    {}
  );

  useEffect(() => {
    fetch(`/api/projects/${slug}`)
      .then((r) => r.json())
      .then(setProject)
      .finally(() => setLoading(false));
  }, [slug]);

  const stats = useMemo(() => {
    if (!project) {
      return {
        totalConcepts: 0,
        totalLearned: 0,
        totalReviewDue: 0,
        totalRelearning: 0,
        overallProgress: 0,
      };
    }

    const totalConcepts = project.chapters.reduce(
      (sum, chapter) => sum + chapter.conceptCount,
      0
    );
    const totalLearned = project.chapters.reduce(
      (sum, chapter) => sum + chapter.learnedConcepts,
      0
    );
    const totalReviewDue = project.chapters.reduce(
      (sum, chapter) => sum + chapter.reviewDue,
      0
    );
    const totalRelearning = project.chapters.reduce(
      (sum, chapter) => sum + chapter.needsRelearning,
      0
    );

    return {
      totalConcepts,
      totalLearned,
      totalReviewDue,
      totalRelearning,
      overallProgress:
        totalConcepts > 0 ? Math.round((totalLearned / totalConcepts) * 100) : 0,
    };
  }, [project]);

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  if (!project) {
    return <div className="text-destructive">프로젝트를 찾을 수 없습니다</div>;
  }

  const primaryAction =
    stats.totalReviewDue > 0
      ? {
          href: `/projects/${slug}/review`,
          label: `복습 시작 (${stats.totalReviewDue})`,
          tone: "secondary" as const,
          helper: "오늘 처리할 복습 항목이 있습니다.",
        }
      : {
          href: `/projects/${slug}/learn`,
          label: stats.totalLearned > 0 ? "학습 계속" : "학습 시작",
          tone: "default" as const,
          helper: "다음 개념으로 바로 이어서 학습하세요.",
        };

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((current) => ({
      ...current,
      [chapterId]: !current[chapterId],
    }));
  };

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/40">
        <div className="space-y-6 px-5 py-6 sm:px-6 sm:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <Badge variant="outline" className="rounded-full px-3 py-1">
                <Sparkles className="size-3.5" />
                학습 대시보드
              </Badge>
              <div>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  {project.name}
                </h1>
                {project.description && (
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                    {project.description}
                  </p>
                )}
              </div>
            </div>
            <div className="min-w-44 rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Overall
              </div>
              <div className="mt-2 text-3xl font-semibold">
                {stats.overallProgress}%
              </div>
              <Progress value={stats.overallProgress} className="mt-3" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              label="학습한 개념"
              value={`${stats.totalLearned}/${stats.totalConcepts}`}
            />
            <StatCard
              label="오늘 복습"
              value={String(stats.totalReviewDue)}
              valueClassName="text-orange-500"
            />
            <StatCard
              label="재학습 필요"
              value={String(stats.totalRelearning)}
              valueClassName="text-red-500"
            />
            <StatCard
              label="챕터 수"
              value={String(project.chapters.length)}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
              <div className="text-sm font-medium">{primaryAction.helper}</div>
              <p className="mt-1 text-sm text-muted-foreground">
                가장 중요한 다음 작업부터 처리할 수 있게 정리했습니다.
              </p>
            </div>
            <Link href={primaryAction.href} className="lg:min-w-44">
              <Button variant={primaryAction.tone} className="h-12 w-full rounded-2xl">
                {primaryAction.label}
              </Button>
            </Link>
            <Link href={`/projects/${slug}/quiz`} className="lg:min-w-32">
              <Button variant="outline" className="h-12 w-full rounded-2xl">
                퀴즈
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {stats.totalRelearning > 0 && (
        <section className="rounded-2xl border border-red-200 bg-red-50/70 px-5 py-4 text-red-900">
          <div className="flex items-start gap-3">
            <RotateCcw className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">재학습이 필요한 개념이 있습니다.</p>
              <p className="mt-1 text-sm text-red-800/80">
                먼저 복습을 진행하거나 문제 챕터부터 다시 보는 편이 효율적입니다.
              </p>
            </div>
          </div>
        </section>
      )}

      <Separator />

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">챕터</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              모바일에서는 요약을 먼저 보고, 필요한 챕터만 펼쳐서 개념을 확인하세요.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {project.chapters.map((chapter) => {
            const expanded = expandedChapters[chapter.id] ?? false;

            return (
              <Card key={chapter.id} className="overflow-hidden border-border/60 py-0">
                <CardHeader className="gap-4 px-5 py-5 sm:px-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="rounded-full">
                          Chapter {chapter.order}
                        </Badge>
                        {chapter.reviewDue > 0 && (
                          <Badge variant="secondary">복습 {chapter.reviewDue}</Badge>
                        )}
                        {chapter.needsRelearning > 0 && (
                          <Badge variant="destructive">
                            재학습 {chapter.needsRelearning}
                          </Badge>
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-lg leading-6">
                          {chapter.title}
                        </CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {chapter.learnedConcepts}/{chapter.conceptCount} 개념 완료
                        </p>
                      </div>
                    </div>
                    <Link href={`/projects/${slug}/learn/${chapter.id}`} className="sm:pt-1">
                      <Button variant="outline" size="sm" className="rounded-full">
                        <BookOpen className="size-4" />
                        학습하기
                      </Button>
                    </Link>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">진도</span>
                        <span className="font-medium">{chapter.progress}%</span>
                      </div>
                      <Progress value={chapter.progress} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-sm">
                      <MiniStat label="개념" value={chapter.conceptCount} />
                      <MiniStat label="복습" value={chapter.reviewDue} />
                      <MiniStat label="완료" value={chapter.learnedConcepts} />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="border-t border-border/60 px-5 py-4 sm:px-6">
                  <button
                    type="button"
                    onClick={() => toggleChapter(chapter.id)}
                    className="flex w-full items-center justify-between rounded-2xl bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted"
                  >
                    <div>
                      <div className="text-sm font-medium">
                        {expanded ? "개념 목록 접기" : "개념 목록 보기"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {chapter.concepts.length}개 개념
                      </div>
                    </div>
                    {expanded ? (
                      <ChevronUp className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    )}
                  </button>

                  {expanded && (
                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                      {chapter.concepts.map((concept) => (
                        <Link
                          key={concept.id}
                          href={`/projects/${slug}/learn/${chapter.id}?conceptId=${concept.id}`}
                          className="flex items-center justify-between rounded-2xl border border-border/60 bg-background px-4 py-3 text-sm transition-colors hover:border-primary/50 hover:bg-muted/30"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {concept.order}. {concept.title}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {concept.progress
                                ? `숙련도 ${concept.progress.mastery}`
                                : "아직 학습 전"}
                            </div>
                          </div>
                          {concept.progress ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                "ml-3 shrink-0 rounded-full",
                                bloomColors[concept.progress.bloomLevelReached] || ""
                              )}
                            >
                              {bloomLabels[concept.progress.bloomLevelReached]}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="ml-3 shrink-0 rounded-full text-muted-foreground"
                            >
                              미학습
                            </Badge>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <div className="sticky bottom-20 z-20 md:hidden">
        <div className="rounded-3xl border border-border/60 bg-background/92 p-3 shadow-lg backdrop-blur">
          <div className="flex gap-2">
            <Link href={primaryAction.href} className="flex-1">
              <Button variant={primaryAction.tone} className="h-11 w-full rounded-2xl">
                {primaryAction.label}
              </Button>
            </Link>
            <Link href={`/projects/${slug}/quiz`} className="flex-1">
              <Button variant="outline" className="h-11 w-full rounded-2xl">
                <ClipboardCheck className="size-4" />
                퀴즈
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={cn("mt-2 text-2xl font-semibold", valueClassName)}>
        {value}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-muted/40 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
