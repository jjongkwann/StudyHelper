"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Chapter {
  id: string;
  title: string;
  order: number;
  conceptCount: number;
}

interface QuizQuestion {
  question: string;
  bloomLevel: number;
  conceptId: string;
  conceptTitle: string;
  hints?: string[];
}

interface QuizResult {
  score: number;
  feedback: string;
  correctAnswer: string;
  needsRelearning: boolean;
}

type Phase = "setup" | "quiz" | "result";

export default function QuizPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [phase, setPhase] = useState<Phase>("setup");

  // Setup
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [bloomLevel, setBloomLevel] = useState("2");
  const [questionCount, setQuestionCount] = useState("5");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Quiz
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [currentResult, setCurrentResult] = useState<QuizResult | null>(null);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);

  // Results
  const [results, setResults] = useState<
    { question: QuizQuestion; result: QuizResult }[]
  >([]);

  useEffect(() => {
    fetch(`/api/projects/${slug}`)
      .then((r) => r.json())
      .then((data) => setChapters(data.chapters || []));
  }, [slug]);

  const toggleChapter = (id: string) => {
    setSelectedChapters((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const startQuiz = async () => {
    if (selectedChapters.length === 0) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/ai/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterIds: selectedChapters,
          bloomLevel: parseInt(bloomLevel),
          count: parseInt(questionCount),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenerateError(data.error || "퀴즈를 생성하지 못했습니다.");
        return;
      }

      setQuestions(data.questions);
      setCurrentIndex(0);
      setCurrentResult(null);
      setEvaluationError(null);
      setResults([]);
      setPhase("quiz");
    } finally {
      setGenerating(false);
    }
  };

  const submitAnswer = async () => {
    if (!answer.trim()) return;
    const question = questions[currentIndex];
    setEvaluating(true);
    setEvaluationError(null);
    try {
      const res = await fetch("/api/ai/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conceptId: question.conceptId,
          question: question.question,
          userAnswer: answer,
          bloomLevel: question.bloomLevel,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        setEvaluationError(result.error || "답변을 평가하지 못했습니다.");
        return;
      }
      setCurrentResult(result);
      setResults((prev) => [...prev, { question, result }]);
    } finally {
      setEvaluating(false);
    }
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setAnswer("");
      setCurrentResult(null);
      setEvaluationError(null);
    } else {
      setPhase("result");
    }
  };

  const bloomLabels: Record<string, string> = {
    "1": "L1 기억",
    "2": "L2 이해",
    "3": "L3 적용",
    "4": "L4 분석",
    "5": "L5 평가",
    "6": "L6 창조",
  };

  // 설정 화면
  if (phase === "setup") {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold">퀴즈 모드</h1>
          <p className="text-muted-foreground mt-1">퀴즈 설정</p>
          <p className="text-xs text-muted-foreground mt-2">
            문제와 채점은 AI가 생성합니다. 중요한 사실 확인은 원문 학습 자료와 함께 보세요.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>챕터 선택</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {chapters.map((ch) => (
              <label
                key={ch.id}
                className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedChapters.includes(ch.id)}
                  onChange={() => toggleChapter(ch.id)}
                  className="rounded"
                />
                <span className="text-sm">
                  {ch.order}. {ch.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({ch.conceptCount}개 개념)
                </span>
              </label>
            ))}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>난이도 (블룸 레벨)</Label>
            <Select value={bloomLevel} onValueChange={setBloomLevel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(bloomLabels).map(([val, label]) => (
                  <SelectItem key={val} value={val}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>문제 수</Label>
            <Select value={questionCount} onValueChange={setQuestionCount}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["3", "5", "10", "15"].map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}문제
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={startQuiz}
          disabled={generating || selectedChapters.length === 0}
          className="w-full"
        >
          {generating ? "문제 생성 중..." : "퀴즈 시작"}
        </Button>
        {generateError && (
          <p className="text-sm text-destructive">{generateError}</p>
        )}
      </div>
    );
  }

  // 퀴즈 진행
  if (phase === "quiz") {
    const question = questions[currentIndex];
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">퀴즈</h1>
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {questions.length}
          </span>
        </div>

        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{
              width: `${((currentIndex + 1) / questions.length) * 100}%`,
            }}
          />
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {bloomLabels[String(question.bloomLevel)]}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {question.conceptTitle}
              </span>
            </div>
            <CardTitle className="text-lg mt-2">{question.question}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="답변을 입력하세요..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={6}
              disabled={!!currentResult}
            />

            {!currentResult ? (
              <div className="space-y-2">
                <Button
                  onClick={submitAnswer}
                  disabled={evaluating || !answer.trim()}
                >
                  {evaluating ? "채점 중..." : "제출"}
                </Button>
                {evaluationError && (
                  <p className="text-sm text-destructive">{evaluationError}</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      currentResult.score >= 3 ? "default" : "destructive"
                    }
                  >
                    {currentResult.score}/5
                  </Badge>
                  {currentResult.needsRelearning && (
                    <Badge variant="destructive">재학습 필요</Badge>
                  )}
                </div>
                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <p className="text-sm">{currentResult.feedback}</p>
                  {currentResult.correctAnswer && (
                    <div>
                      <h4 className="text-sm font-semibold mt-2">모범 답안</h4>
                      <p className="text-sm text-muted-foreground">
                        {currentResult.correctAnswer}
                      </p>
                    </div>
                  )}
                </div>
                <Button onClick={nextQuestion}>
                  {currentIndex < questions.length - 1
                    ? "다음 문제"
                    : "결과 보기"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // 결과 화면
  const avgScore =
    results.length > 0
      ? Math.round(
          (results.reduce((sum, r) => sum + r.result.score, 0) /
            results.length) *
            20
        )
      : 0;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold">퀴즈 결과</h1>
        <p className="text-muted-foreground mt-1">평균 점수: {avgScore}%</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-green-500">
              {results.filter((r) => r.result.score >= 4).length}
            </div>
            <div className="text-sm text-muted-foreground">우수</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-yellow-500">
              {results.filter((r) => r.result.score === 3).length}
            </div>
            <div className="text-sm text-muted-foreground">보통</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-red-500">
              {results.filter((r) => r.result.score < 3).length}
            </div>
            <div className="text-sm text-muted-foreground">부족</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        {results.map((r, i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <Badge
                  variant={r.result.score >= 3 ? "default" : "destructive"}
                >
                  {r.result.score}/5
                </Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium">{r.question.question}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {r.result.feedback}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button onClick={() => setPhase("setup")} variant="outline">
        다시 하기
      </Button>
    </div>
  );
}
