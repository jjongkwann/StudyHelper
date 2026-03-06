"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
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

export default function LearnPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [currentConceptIndex, setCurrentConceptIndex] = useState(0);
  const [learnContent, setLearnContent] = useState<LearnContent | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<{
    score: number;
    feedback: string;
  } | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${slug}`)
      .then((r) => r.json())
      .then((data) => setChapters(data.chapters || []));
  }, [slug]);

  const loadConcept = useCallback(async (conceptId: string) => {
    setLoadingContent(true);
    setLearnContent(null);
    setAnswer("");
    setEvaluation(null);
    try {
      const res = await fetch("/api/ai/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conceptId }),
      });
      const data = await res.json();
      setLearnContent(data);
    } finally {
      setLoadingContent(false);
    }
  }, []);

  const startChapter = (chapter: Chapter) => {
    setSelectedChapter(chapter);
    setCurrentConceptIndex(0);
    if (chapter.concepts.length > 0) {
      loadConcept(chapter.concepts[0].id);
    }
  };

  const nextConcept = () => {
    if (!selectedChapter) return;
    const nextIndex = currentConceptIndex + 1;
    if (nextIndex < selectedChapter.concepts.length) {
      setCurrentConceptIndex(nextIndex);
      loadConcept(selectedChapter.concepts[nextIndex].id);
    }
  };

  const handleCheckAnswer = async () => {
    if (!learnContent?.checkQuestion || !answer.trim()) return;
    if (!selectedChapter) return;
    const concept = selectedChapter.concepts[currentConceptIndex];

    setEvaluating(true);
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
      setEvaluation(data);
    } finally {
      setEvaluating(false);
    }
  };

  const currentConcept = selectedChapter?.concepts[currentConceptIndex];

  // 챕터 선택 화면
  if (!selectedChapter) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">학습 모드</h1>
          <p className="text-muted-foreground mt-1">학습할 챕터를 선택하세요</p>
        </div>
        <div className="space-y-3">
          {chapters.map((chapter) => {
            const learned = chapter.concepts.filter(
              (c) => c.progress && c.progress.mastery >= 3
            ).length;
            return (
              <Card
                key={chapter.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => startChapter(chapter)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {chapter.order}. {chapter.title}
                    </CardTitle>
                    <Badge variant="outline">
                      {learned}/{chapter.concepts.length} 완료
                    </Badge>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // 학습 화면
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{selectedChapter.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {currentConceptIndex + 1} / {selectedChapter.concepts.length} 개념
          </p>
        </div>
        <Button variant="outline" onClick={() => setSelectedChapter(null)}>
          챕터 목록
        </Button>
      </div>

      {/* 진행 바 */}
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all"
          style={{
            width: `${((currentConceptIndex + 1) / selectedChapter.concepts.length) * 100}%`,
          }}
        />
      </div>

      {currentConcept && (
        <Card>
          <CardHeader>
            <CardTitle>{currentConcept.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {loadingContent ? (
              <div className="text-muted-foreground py-8 text-center">
                AI가 학습 콘텐츠를 준비하고 있습니다...
              </div>
            ) : learnContent ? (
              <>
                {/* 설명 */}
                <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
                  {learnContent.explanation}
                </div>

                {/* 핵심 포인트 */}
                {learnContent.keyPoints.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">핵심 포인트</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {learnContent.keyPoints.map((point, i) => (
                        <li key={i}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 비유 */}
                {learnContent.analogy && (
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-1 text-sm">비유로 이해하기</h3>
                    <p className="text-sm">{learnContent.analogy}</p>
                  </div>
                )}

                <Separator />

                {/* 이해도 체크 */}
                {learnContent.checkQuestion && (
                  <div className="space-y-4">
                    <h3 className="font-semibold">이해도 확인</h3>
                    <p className="text-sm">
                      {learnContent.checkQuestion.question}
                    </p>
                    <Textarea
                      placeholder="답변을 입력하세요..."
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      rows={4}
                    />
                    {!evaluation ? (
                      <Button
                        onClick={handleCheckAnswer}
                        disabled={evaluating || !answer.trim()}
                      >
                        {evaluating ? "평가 중..." : "답변 확인"}
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              evaluation.score >= 3 ? "default" : "destructive"
                            }
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
                        <p className="text-sm bg-muted/50 p-3 rounded">
                          {evaluation.feedback}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 다음 개념 */}
                <div className="flex justify-end pt-4">
                  {currentConceptIndex < selectedChapter.concepts.length - 1 ? (
                    <Button onClick={nextConcept}>다음 개념</Button>
                  ) : (
                    <Button onClick={() => setSelectedChapter(null)}>
                      챕터 완료
                    </Button>
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
