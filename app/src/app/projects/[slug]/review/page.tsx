"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface ReviewItem {
  conceptId: string;
  conceptTitle: string;
  chapterTitle: string;
  mastery: number;
  easeFactor: number;
  intervalDays: number;
  needsRelearning: boolean;
}

interface ReviewData {
  dueCount: number;
  relearningCount: number;
  dueItems: ReviewItem[];
  relearningItems: { conceptId: string; conceptTitle: string; chapterTitle: string }[];
}

export default function ReviewPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState<string | null>(null);

  // Review session
  const [currentIndex, setCurrentIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [question, setQuestion] = useState<string | null>(null);
  const [generatingQ, setGeneratingQ] = useState(false);
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<{
    score: number;
    feedback: string;
    correctAnswer: string;
    needsRelearning: boolean;
  } | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [completed, setCompleted] = useState(0);

  useEffect(() => {
    fetch(`/api/projects/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        setProjectId(data.id);
        return fetch(`/api/progress/review?projectId=${data.id}`);
      })
      .then((r) => r.json())
      .then(setReviewData)
      .finally(() => setLoading(false));
  }, [slug]);

  const generateQuestion = useCallback(async (conceptId: string) => {
    setGeneratingQ(true);
    setQuestion(null);
    setAnswer("");
    setEvaluation(null);
    try {
      const res = await fetch("/api/ai/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterIds: [], // will use conceptId directly
          bloomLevel: 2,
          count: 1,
        }),
      });
      const data = await res.json();
      // Fallback: generate from concept directly
      if (data.questions?.[0]) {
        setQuestion(data.questions[0].question);
      } else {
        // Simple fallback question
        setQuestion("이 개념을 자신의 말로 설명해보세요.");
      }
    } catch {
      setQuestion("이 개념을 자신의 말로 설명해보세요.");
    } finally {
      setGeneratingQ(false);
    }
  }, []);

  const startReview = () => {
    if (!reviewData || reviewData.dueItems.length === 0) return;
    setStarted(true);
    setCurrentIndex(0);
    // Use simple recall question for review
    setQuestion(
      `"${reviewData.dueItems[0].conceptTitle}" 개념을 설명해보세요.`
    );
  };

  const submitAnswer = async () => {
    if (!reviewData || !answer.trim()) return;
    const item = reviewData.dueItems[currentIndex];
    setEvaluating(true);
    try {
      const res = await fetch("/api/ai/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conceptId: item.conceptId,
          question: question || `${item.conceptTitle}을(를) 설명하세요`,
          userAnswer: answer,
          bloomLevel: 2,
        }),
      });
      const data = await res.json();
      setEvaluation(data);
      setCompleted((c) => c + 1);
    } finally {
      setEvaluating(false);
    }
  };

  const nextItem = () => {
    if (!reviewData) return;
    const next = currentIndex + 1;
    if (next < reviewData.dueItems.length) {
      setCurrentIndex(next);
      setAnswer("");
      setEvaluation(null);
      setQuestion(
        `"${reviewData.dueItems[next].conceptTitle}" 개념을 설명해보세요.`
      );
    } else {
      setStarted(false);
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  if (!reviewData) {
    return <div className="text-destructive">데이터를 불러올 수 없습니다</div>;
  }

  // 복습 시작 전
  if (!started) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold">복습 모드</h1>
          <p className="text-muted-foreground mt-1">
            간격 반복(Spaced Repetition) 기반 복습
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-orange-500">
                {reviewData.dueCount}
              </div>
              <div className="text-sm text-muted-foreground">오늘 복습 예정</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-red-500">
                {reviewData.relearningCount}
              </div>
              <div className="text-sm text-muted-foreground">재학습 필요</div>
            </CardContent>
          </Card>
        </div>

        {reviewData.relearningCount > 0 && (
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600 text-lg">
                재학습 필요 항목
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {reviewData.relearningItems.map((item) => (
                  <div
                    key={item.conceptId}
                    className="flex items-center justify-between p-2 rounded border text-sm"
                  >
                    <span>{item.conceptTitle}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.chapterTitle}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {reviewData.dueCount > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">오늘의 복습 항목</h2>
            {reviewData.dueItems.map((item) => (
              <div
                key={item.conceptId}
                className="flex items-center justify-between p-3 rounded border text-sm"
              >
                <div>
                  <span className="font-medium">{item.conceptTitle}</span>
                  <span className="text-muted-foreground ml-2">
                    ({item.chapterTitle})
                  </span>
                </div>
                <div className="flex gap-2">
                  {item.needsRelearning && (
                    <Badge variant="destructive">재학습</Badge>
                  )}
                  <Badge variant="outline">EF {item.easeFactor}</Badge>
                </div>
              </div>
            ))}
            <Button onClick={startReview} className="w-full">
              복습 시작 ({reviewData.dueCount}개)
            </Button>
          </div>
        )}

        {reviewData.dueCount === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              오늘 복습할 항목이 없습니다. 잘 하고 있어요!
            </CardContent>
          </Card>
        )}

        {completed > 0 && (
          <p className="text-sm text-green-600">
            이번 세션에서 {completed}개 복습 완료!
          </p>
        )}
      </div>
    );
  }

  // 복습 진행
  const currentItem = reviewData.dueItems[currentIndex];
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">복습</h1>
        <span className="text-sm text-muted-foreground">
          {currentIndex + 1} / {reviewData.dueItems.length}
        </span>
      </div>

      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-primary h-2 rounded-full transition-all"
          style={{
            width: `${((currentIndex + 1) / reviewData.dueItems.length) * 100}%`,
          }}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{currentItem.chapterTitle}</Badge>
            {currentItem.needsRelearning && (
              <Badge variant="destructive">재학습 필요</Badge>
            )}
          </div>
          <CardTitle className="text-lg mt-2">
            {question || `"${currentItem.conceptTitle}" 개념을 설명해보세요.`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="답변을 입력하세요..."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={6}
            disabled={!!evaluation}
          />

          {!evaluation ? (
            <Button
              onClick={submitAnswer}
              disabled={evaluating || !answer.trim()}
            >
              {evaluating ? "채점 중..." : "제출"}
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge
                  variant={evaluation.score >= 3 ? "default" : "destructive"}
                >
                  {evaluation.score}/5
                </Badge>
                {evaluation.needsRelearning && (
                  <Badge variant="destructive">재학습 필요</Badge>
                )}
              </div>
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <p className="text-sm">{evaluation.feedback}</p>
                {evaluation.correctAnswer && (
                  <div>
                    <h4 className="text-sm font-semibold mt-2">모범 답안</h4>
                    <p className="text-sm text-muted-foreground">
                      {evaluation.correctAnswer}
                    </p>
                  </div>
                )}
              </div>
              <Button onClick={nextItem}>
                {currentIndex < reviewData.dueItems.length - 1
                  ? "다음"
                  : "완료"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
