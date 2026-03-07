"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, BookOpen } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Concept {
  id: string;
  progress: { mastery: number } | null;
}

interface Chapter {
  id: string;
  title: string;
  order: number;
  concepts: Concept[];
}

export default function LearnHubPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${slug}`)
      .then((r) => r.json())
      .then((data) => setChapters(data.chapters || []))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">학습 모드</h1>
        <p className="mt-1 text-muted-foreground">시작할 챕터를 선택하세요</p>
        <p className="mt-2 text-xs text-muted-foreground">
          설명은 AI가 원문을 바탕으로 재구성합니다. 정확한 확인이 필요하면 원문 자료를 함께 보세요.
        </p>
      </div>

      <div className="space-y-3">
        {chapters.map((chapter) => {
          const learned = chapter.concepts.filter(
            (concept) => concept.progress && concept.progress.mastery >= 3
          ).length;

          return (
            <Link
              key={chapter.id}
              href={`/projects/${slug}/learn/${chapter.id}`}
              className="block"
            >
              <Card className="transition-colors hover:border-primary/50">
                <CardHeader className="gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Chapter {chapter.order}</Badge>
                        <Badge variant="secondary">{chapter.concepts.length}개 개념</Badge>
                      </div>
                      <CardTitle className="text-lg">{chapter.title}</CardTitle>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0 rounded-full">
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{learned}/{chapter.concepts.length} 완료</span>
                    <span className="inline-flex items-center gap-1">
                      <BookOpen className="size-4" />
                      학습 시작
                    </span>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
