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

  const totalReviewDue = projects.reduce((sum, p) => sum + p.reviewDue, 0);

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
            <div className="text-3xl font-bold">{projects.length}</div>
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
              {projects.length > 0
                ? Math.round(
                    projects.reduce((sum, p) => sum + p.progress, 0) /
                      projects.length
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
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.slug}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{project.name}</CardTitle>
                    {project.reviewDue > 0 && (
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
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
