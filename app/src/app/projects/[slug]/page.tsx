"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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

  useEffect(() => {
    fetch(`/api/projects/${slug}`)
      .then((r) => r.json())
      .then(setProject)
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  if (!project) {
    return <div className="text-destructive">프로젝트를 찾을 수 없습니다</div>;
  }

  const totalConcepts = project.chapters.reduce(
    (sum, ch) => sum + ch.conceptCount,
    0
  );
  const totalLearned = project.chapters.reduce(
    (sum, ch) => sum + ch.learnedConcepts,
    0
  );
  const totalReviewDue = project.chapters.reduce(
    (sum, ch) => sum + ch.reviewDue,
    0
  );
  const totalRelearning = project.chapters.reduce(
    (sum, ch) => sum + ch.needsRelearning,
    0
  );
  const overallProgress =
    totalConcepts > 0 ? Math.round((totalLearned / totalConcepts) * 100) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{project.name}</h1>
        {project.description && (
          <p className="text-muted-foreground mt-1">{project.description}</p>
        )}
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">전체 진도</div>
            <div className="text-2xl font-bold mt-1">{overallProgress}%</div>
            <Progress value={overallProgress} className="mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">학습한 개념</div>
            <div className="text-2xl font-bold mt-1">
              {totalLearned}/{totalConcepts}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">복습 예정</div>
            <div className="text-2xl font-bold mt-1 text-orange-500">
              {totalReviewDue}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">재학습 필요</div>
            <div className="text-2xl font-bold mt-1 text-red-500">
              {totalRelearning}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-3">
        <Link href={`/projects/${slug}/learn`}>
          <Button>학습 시작</Button>
        </Link>
        <Link href={`/projects/${slug}/quiz`}>
          <Button variant="outline">퀴즈</Button>
        </Link>
        {totalReviewDue > 0 && (
          <Link href={`/projects/${slug}/review`}>
            <Button variant="secondary">
              복습 ({totalReviewDue})
            </Button>
          </Link>
        )}
      </div>

      <Separator />

      {/* 챕터 목록 */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">챕터</h2>
        {project.chapters.map((chapter) => (
          <Card key={chapter.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {chapter.order}. {chapter.title}
                </CardTitle>
                <div className="flex gap-2">
                  {chapter.needsRelearning > 0 && (
                    <Badge variant="destructive">
                      재학습 {chapter.needsRelearning}
                    </Badge>
                  )}
                  {chapter.reviewDue > 0 && (
                    <Badge variant="secondary">복습 {chapter.reviewDue}</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <Progress value={chapter.progress} className="flex-1" />
                <span className="text-sm text-muted-foreground w-16 text-right">
                  {chapter.progress}%
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {chapter.concepts.map((concept) => (
                  <div
                    key={concept.id}
                    className="flex items-center justify-between p-2 rounded border text-sm"
                  >
                    <span className="truncate flex-1">{concept.title}</span>
                    <div className="flex gap-1 ml-2">
                      {concept.progress ? (
                        <Badge
                          variant="outline"
                          className={
                            bloomColors[concept.progress.bloomLevelReached] || ""
                          }
                        >
                          {bloomLabels[concept.progress.bloomLevelReached]}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          미학습
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
