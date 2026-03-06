"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface ProjectSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  importStep: string | null;
  importProgress: number | null;
  errorMessage: string | null;
  chapterCount: number;
  totalConcepts: number;
  learnedConcepts: number;
  reviewDue: number;
  progress: number;
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  const readyProjects = projects.filter((p) => p.status === "ready");
  const totalReviewDue = readyProjects.reduce((sum, p) => sum + p.reviewDue, 0);

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          학습 현황을 한눈에 확인하세요
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              전체 프로젝트
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{readyProjects.length}</div>
            {projects.length !== readyProjects.length && (
              <p className="text-xs text-muted-foreground">
                +{projects.length - readyProjects.length} 임포트 중/실패
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              오늘 복습 예정
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {totalReviewDue > 0 ? (
                <span className="text-orange-500">{totalReviewDue}</span>
              ) : (
                <span className="text-green-500">0</span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              전체 진도율
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {readyProjects.length > 0
                ? Math.round(
                    readyProjects.reduce((sum, p) => sum + p.progress, 0) /
                      readyProjects.length
                  )
                : 0}
              %
            </div>
          </CardContent>
        </Card>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              아직 프로젝트가 없습니다
            </p>
            <Link
              href="/projects"
              className="text-primary underline hover:no-underline"
            >
              프로젝트 만들기
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((project) => {
            const isReady = project.status === "ready";
            const isProcessing =
              project.status === "pending" || project.status === "processing";
            const isFailed = project.status === "failed";

            const card = (
              <Card
                className={`transition-colors ${
                  isReady
                    ? "hover:border-primary/50 cursor-pointer"
                    : isFailed
                      ? "border-red-300 dark:border-red-800"
                      : "border-yellow-300 dark:border-yellow-800"
                }`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{project.name}</CardTitle>
                    {isProcessing && (
                      <Badge variant="secondary">임포트 중</Badge>
                    )}
                    {isFailed && (
                      <Badge variant="destructive">실패</Badge>
                    )}
                    {isReady && project.reviewDue > 0 && (
                      <Badge variant="destructive">
                        복습 {project.reviewDue}
                      </Badge>
                    )}
                  </div>
                  {project.description && (
                    <p className="text-sm text-muted-foreground">
                      {project.description}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  {isProcessing && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {project.importStep || "준비 중..."}
                      </p>
                      <Progress
                        value={(project.importProgress ?? 0) * 100}
                      />
                    </div>
                  )}
                  {isFailed && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {project.errorMessage || "알 수 없는 오류"}
                    </p>
                  )}
                  {isReady && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>
                          {project.learnedConcepts}/{project.totalConcepts} 개념
                        </span>
                        <span>{project.progress}%</span>
                      </div>
                      <Progress value={project.progress} />
                      <div className="text-xs text-muted-foreground">
                        {project.chapterCount}개 챕터
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );

            if (isReady) {
              return (
                <Link key={project.id} href={`/projects/${project.slug}`}>
                  {card}
                </Link>
              );
            }
            return <div key={project.id}>{card}</div>;
          })}
        </div>
      )}
    </div>
  );
}
