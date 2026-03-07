"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown, ChevronUp, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface Concept {
  id: string;
  title: string;
  order: number;
  progress: { mastery: number } | null;
}

interface Chapter {
  id: string;
  title: string;
  order: number;
  concepts: Concept[];
}

interface LearnContent {
  explanation: string;
  keyPoints: string[];
  analogy?: string;
  checkQuestion?: {
    question: string;
    expectedAnswer: string;
  };
}

export default function ChapterLearnPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const chapterId = params.chapterId as string;
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [loadingChapter, setLoadingChapter] = useState(true);
  const [currentConceptIndex, setCurrentConceptIndex] = useState(0);
  const [conceptListOpen, setConceptListOpen] = useState(false);
  const [learnContent, setLearnContent] = useState<LearnContent | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<{
    score: number;
    feedback: string;
  } | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingChapter(true);
    fetch(`/api/projects/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        const matched = (data.chapters || []).find(
          (item: Chapter) => item.id === chapterId
        );
        setChapter(matched || null);

        const conceptIdParam = searchParams.get("conceptId");
        if (conceptIdParam && matched) {
          const idx = matched.concepts.findIndex(
            (c: Concept) => c.id === conceptIdParam
          );
          setCurrentConceptIndex(idx >= 0 ? idx : 0);
        } else {
          setCurrentConceptIndex(0);
        }
      })
      .finally(() => setLoadingChapter(false));
  }, [slug, chapterId, searchParams]);

  const loadConcept = useCallback(async (conceptId: string) => {
    setLoadingContent(true);
    setLearnContent(null);
    setLoadError(null);
    setAnswer("");
    setEvaluation(null);
    setEvaluationError(null);
    try {
      const res = await fetch("/api/ai/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conceptId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.error || "학습 콘텐츠를 불러오지 못했습니다.");
        return;
      }
      setLearnContent(data);
    } finally {
      setLoadingContent(false);
    }
  }, []);

  useEffect(() => {
    if (!chapter || chapter.concepts.length === 0) return;
    const concept = chapter.concepts[currentConceptIndex];
    if (concept) {
      loadConcept(concept.id);
    }
  }, [chapter, currentConceptIndex, loadConcept]);

  useEffect(() => {
    if (!chapter || chapter.concepts.length === 0) return;

    const currentConcept = chapter.concepts[currentConceptIndex];
    void fetch("/api/ai/learn/prefetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chapterId: chapter.id,
        excludeConceptId: currentConcept?.id,
      }),
    }).catch(() => {
      // Prefetch failures should not block the foreground learning flow.
    });
  }, [chapter, currentConceptIndex]);

  const handleCheckAnswer = async () => {
    if (!learnContent?.checkQuestion || !answer.trim() || !chapter) return;
    const concept = chapter.concepts[currentConceptIndex];
    if (!concept) return;

    setEvaluating(true);
    setEvaluationError(null);
    try {
      const res = await fetch("/api/ai/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conceptId: concept.id,
          question: learnContent.checkQuestion.question,
          userAnswer: answer,
          bloomLevel: 2,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEvaluationError(data.error || "답변을 평가하지 못했습니다.");
        return;
      }
      setEvaluation(data);
    } finally {
      setEvaluating(false);
    }
  };

  const jumpToConcept = (index: number) => {
    if (!chapter) return;
    const concept = chapter.concepts[index];
    if (!concept) return;
    setCurrentConceptIndex(index);
    router.replace(
      `/projects/${slug}/learn/${chapterId}?conceptId=${concept.id}`,
      { scroll: false }
    );
  };

  const nextConcept = () => {
    if (!chapter) return;
    const nextIndex = currentConceptIndex + 1;
    if (nextIndex < chapter.concepts.length) {
      jumpToConcept(nextIndex);
    }
  };

  if (loadingChapter) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  if (!chapter) {
    return <div className="text-destructive">챕터를 찾을 수 없습니다.</div>;
  }

  const currentConcept = chapter.concepts[currentConceptIndex];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">Chapter {chapter.order}</div>
          <h1 className="text-2xl font-bold">{chapter.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {currentConceptIndex + 1} / {chapter.concepts.length} 개념
          </p>
        </div>
        <Link href={`/projects/${slug}/learn`}>
          <Button variant="outline">챕터 목록</Button>
        </Link>
      </div>

      <div className="w-full rounded-full bg-muted h-2">
        <div
          className="h-2 rounded-full bg-primary transition-all"
          style={{
            width: `${((currentConceptIndex + 1) / chapter.concepts.length) * 100}%`,
          }}
        />
      </div>

      <div>
        <button
          onClick={() => setConceptListOpen((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted/50"
        >
          <span>
            개념 목록 ({currentConceptIndex + 1}/{chapter.concepts.length})
          </span>
          {conceptListOpen ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </button>
        {conceptListOpen && (
          <ul className="mt-1 space-y-0.5 rounded-lg border p-1">
            {chapter.concepts.map((concept, index) => {
              const isCurrent = index === currentConceptIndex;
              const mastered =
                concept.progress && concept.progress.mastery >= 3;
              return (
                <li key={concept.id}>
                  <button
                    onClick={() => {
                      jumpToConcept(index);
                      setConceptListOpen(false);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      isCurrent
                        ? "bg-primary/10 font-medium text-primary"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    {mastered ? (
                      <CheckCircle2 className="size-4 shrink-0 text-green-500" />
                    ) : isCurrent && loadingContent ? (
                      <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                    ) : (
                      <Circle className="size-4 shrink-0 text-muted-foreground/40" />
                    )}
                    <span className="truncate">
                      {concept.order}. {concept.title}
                    </span>
                    {isCurrent && (
                      <Badge variant="outline" className="ml-auto shrink-0 text-xs">
                        현재
                      </Badge>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {currentConcept && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{currentConcept.order}번째 개념</Badge>
              {currentConcept.progress && (
                <Badge variant="secondary">숙련도 {currentConcept.progress.mastery}</Badge>
              )}
            </div>
            <CardTitle>{currentConcept.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {loadingContent ? (
              <div className="py-8 text-center text-muted-foreground">
                AI가 학습 콘텐츠를 준비하고 있습니다...
              </div>
            ) : loadError ? (
              <div className="space-y-3 py-8 text-center">
                <p className="text-sm text-destructive">{loadError}</p>
                <Button variant="outline" onClick={() => loadConcept(currentConcept.id)}>
                  다시 시도
                </Button>
              </div>
            ) : learnContent ? (
              <>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {learnContent.explanation}
                  </ReactMarkdown>
                </div>

                {learnContent.keyPoints.length > 0 && (
                  <div>
                    <h3 className="mb-2 font-semibold">핵심 포인트</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {learnContent.keyPoints.map((point, index) => (
                        <li key={index}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {learnContent.analogy && (
                  <div className="rounded-lg bg-muted/50 p-4">
                    <h3 className="mb-1 text-sm font-semibold">비유로 이해하기</h3>
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {learnContent.analogy}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}

                <Separator />

                {learnContent.checkQuestion && (
                  <div className="space-y-4">
                    <h3 className="font-semibold">이해도 확인</h3>
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {learnContent.checkQuestion.question}
                      </ReactMarkdown>
                    </div>
                    <Textarea
                      placeholder="답변을 입력하세요..."
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      rows={4}
                    />
                    {!evaluation ? (
                      <div className="space-y-2">
                        <Button
                          onClick={handleCheckAnswer}
                          disabled={evaluating || !answer.trim()}
                        >
                          {evaluating ? "평가 중..." : "답변 확인"}
                        </Button>
                        {evaluationError && (
                          <p className="text-sm text-destructive">{evaluationError}</p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={evaluation.score >= 3 ? "default" : "destructive"}
                          >
                            {evaluation.score}/5
                          </Badge>
                          <span className="text-sm">
                            {evaluation.score >= 4
                              ? "잘 이해하고 있습니다!"
                              : evaluation.score >= 3
                                ? "기본은 이해했습니다"
                                : "다시 확인이 필요합니다"}
                          </span>
                        </div>
                        <p className="rounded bg-muted/50 p-3 text-sm">
                          {evaluation.feedback}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  {currentConceptIndex < chapter.concepts.length - 1 ? (
                    <Button onClick={nextConcept}>다음 개념</Button>
                  ) : (
                    <Link href={`/projects/${slug}/learn`}>
                      <Button>챕터 완료</Button>
                    </Link>
                  )}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
