"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark.min.css";
import { ChevronDown, ChevronUp, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { AnnotationPanel } from "@/components/annotation-panel";
import { UserNoteSection } from "@/components/user-note-section";

interface Annotation {
  id: string;
  type: "highlight" | "memo";
  selectedText: string;
  note: string | null;
  color: string;
  startOffset: number | null;
  endOffset: number | null;
  createdAt: string;
}

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
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [annotationRefreshKey, setAnnotationRefreshKey] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLDivElement>(null);
  const originalArticleHtmlRef = useRef("");
  const [activeMemoId, setActiveMemoId] = useState<string | null>(null);
  const [memoPopoverPos, setMemoPopoverPos] = useState({ top: 0, left: 0 });
  const [memoDraft, setMemoDraft] = useState("");
  const currentConcept = chapter?.concepts[currentConceptIndex] ?? null;

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

  const fetchAnnotations = useCallback(async (conceptId: string) => {
    const res = await fetch(`/api/annotations?conceptId=${conceptId}`);
    if (!res.ok) {
      setAnnotations([]);
      return;
    }
    const data = (await res.json()) as Annotation[];
    setAnnotations(data);
  }, []);

  useEffect(() => {
    const concept = chapter?.concepts[currentConceptIndex];
    if (!concept) return;
    setActiveMemoId(null);
    void fetchAnnotations(concept.id);
  }, [chapter, currentConceptIndex, fetchAnnotations, annotationRefreshKey]);

  useEffect(() => {
    const article = articleRef.current;
    if (!article || !learnContent || !currentConcept) return;

    originalArticleHtmlRef.current = article.innerHTML;
  }, [learnContent, currentConcept]);

  useEffect(() => {
    const article = articleRef.current;
    if (!article || !learnContent || !originalArticleHtmlRef.current) return;

    article.innerHTML = originalArticleHtmlRef.current;
    renderAnnotations(article, annotations, {
      onMemoOpen: (annotation, position) => {
        setActiveMemoId(annotation.id);
        setMemoDraft(annotation.note ?? "");
        setMemoPopoverPos(position);
      },
    });
  }, [annotations, learnContent]);

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

  const handleAnnotationUpdate = useCallback(
    async (id: string, data: { note?: string | null }) => {
      const res = await fetch(`/api/annotations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) return;
      const updated = (await res.json()) as Annotation;
      setAnnotations((prev) =>
        prev.map((annotation) =>
          annotation.id === id ? { ...annotation, ...updated } : annotation
        )
      );
      if (activeMemoId === id) {
        setMemoDraft(updated.note ?? "");
      }
    },
    [activeMemoId]
  );

  const handleAnnotationDelete = useCallback(async (id: string) => {
    const res = await fetch(`/api/annotations/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setAnnotations((prev) => prev.filter((annotation) => annotation.id !== id));
    if (activeMemoId === id) {
      setActiveMemoId(null);
      setMemoDraft("");
    }
  }, [activeMemoId]);

  if (loadingChapter) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  if (!chapter) {
    return <div className="text-destructive">챕터를 찾을 수 없습니다.</div>;
  }

  const activeMemo =
    activeMemoId
      ? annotations.find((annotation) => annotation.id === activeMemoId) ?? null
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/projects" className="transition-colors hover:text-foreground">
          프로젝트
        </Link>
        <span>/</span>
        <Link
          href={`/projects/${slug}`}
          className="transition-colors hover:text-foreground"
        >
          프로젝트 상세
        </Link>
        <span>/</span>
        <Link
          href={`/projects/${slug}/learn`}
          className="transition-colors hover:text-foreground"
        >
          학습 모드
        </Link>
        <span>/</span>
        <span className="text-foreground">{chapter.title}</span>
      </div>

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
            <div ref={contentRef} className="relative">
              <SelectionToolbar
                containerRef={contentRef}
                conceptId={currentConcept.id}
                onSaved={() => setAnnotationRefreshKey((k) => k + 1)}
              />
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
                <div ref={articleRef} className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex, rehypeHighlight]}>
                    {learnContent.explanation}
                  </ReactMarkdown>
                </div>

                {learnContent.keyPoints.length > 0 && (
                  <div>
                    <h3 className="mb-2 font-semibold">핵심 포인트</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {learnContent.keyPoints.map((point, index) => (
                        <li key={index}>
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex, rehypeHighlight]}
                            components={{ p: ({ children }) => <span>{children}</span> }}
                          >
                            {point}
                          </ReactMarkdown>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {learnContent.analogy && (
                  <div className="rounded-lg bg-muted/50 p-4">
                    <h3 className="mb-1 text-sm font-semibold">비유로 이해하기</h3>
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex, rehypeHighlight]}>
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
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex, rehypeHighlight]}>
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

            {activeMemo && (
              <div
                className="absolute z-40 w-72 rounded-xl border border-border/60 bg-popover p-3 shadow-xl"
                style={{
                  top: memoPopoverPos.top,
                  left: memoPopoverPos.left,
                  transform: "translateX(-50%)",
                }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-semibold text-muted-foreground">메모</div>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setActiveMemoId(null)}
                  >
                    닫기
                  </button>
                </div>
                <blockquote className="mb-3 border-l-2 border-primary/30 pl-2 text-xs italic text-muted-foreground">
                  {activeMemo.selectedText}
                </blockquote>
                <Textarea
                  value={memoDraft}
                  onChange={(e) => setMemoDraft(e.target.value)}
                  rows={4}
                  placeholder="메모를 입력하세요..."
                />
                <div className="mt-3 flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAnnotationDelete(activeMemo.id)}
                  >
                    삭제
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      handleAnnotationUpdate(activeMemo.id, {
                        note: memoDraft.trim() || null,
                      })
                    }
                  >
                    저장
                  </Button>
                </div>
              </div>
            )}
            </div>

            {currentConcept && learnContent && (
              <>
                <Separator />
                <UserNoteSection conceptId={currentConcept.id} />
                <Separator />
                <AnnotationPanel
                  annotations={annotations}
                  onUpdate={handleAnnotationUpdate}
                  onDelete={handleAnnotationDelete}
                  refreshKey={annotationRefreshKey}
                />
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const highlightColors: Record<string, string> = {
  yellow: "#fef08a",
  blue: "#bfdbfe",
  green: "#bbf7d0",
  pink: "#fbcfe8",
};

function renderAnnotations(
  container: HTMLElement,
  annotations: Annotation[],
  options: {
    onMemoOpen: (
      annotation: Annotation,
      position: { top: number; left: number }
    ) => void;
  }
) {
  const ordered = [...annotations]
    .filter(
      (annotation) =>
        annotation.startOffset !== null &&
        annotation.endOffset !== null &&
        annotation.startOffset < annotation.endOffset
    )
    .sort((a, b) => {
      const aLen = (a.endOffset ?? 0) - (a.startOffset ?? 0);
      const bLen = (b.endOffset ?? 0) - (b.startOffset ?? 0);
      if (bLen !== aLen) return bLen - aLen;
      if (a.startOffset !== b.startOffset) {
        return (a.startOffset ?? 0) - (b.startOffset ?? 0);
      }
      if (a.type === b.type) return 0;
      return a.type === "highlight" ? -1 : 1;
    });

  for (const annotation of ordered) {
    const range = createRangeFromOffsets(
      container,
      annotation.startOffset ?? 0,
      annotation.endOffset ?? 0
    );
    if (!range) continue;

    if (annotation.type === "highlight") {
      wrapRangeWithHighlight(range, annotation.color);
      continue;
    }

    wrapRangeWithMemo(range, annotation, container, options.onMemoOpen);
  }
}

function createRangeFromOffsets(
  container: HTMLElement,
  startOffset: number,
  endOffset: number
) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  let cursor = 0;
  let startNode: Text | null = null;
  let endNode: Text | null = null;
  let startNodeOffset = 0;
  let endNodeOffset = 0;

  while ((node = walker.nextNode())) {
    const textNode = node as Text;
    const length = textNode.textContent?.length ?? 0;
    const nextCursor = cursor + length;

    if (!startNode && startOffset >= cursor && startOffset <= nextCursor) {
      startNode = textNode;
      startNodeOffset = startOffset - cursor;
    }

    if (!endNode && endOffset >= cursor && endOffset <= nextCursor) {
      endNode = textNode;
      endNodeOffset = endOffset - cursor;
    }

    cursor = nextCursor;
  }

  if (!startNode || !endNode) return null;

  const range = document.createRange();
  range.setStart(startNode, startNodeOffset);
  range.setEnd(endNode, endNodeOffset);
  return range;
}

function wrapRangeWithHighlight(range: Range, color: string) {
  const mark = document.createElement("mark");
  mark.setAttribute("data-annotation-hl", "");
  mark.style.backgroundColor = highlightColors[color] || highlightColors.yellow;
  mark.style.borderRadius = "2px";
  mark.style.padding = "0 1px";

  try {
    const fragment = range.extractContents();
    mark.appendChild(fragment);
    range.insertNode(mark);
  } catch {}
}

function wrapRangeWithMemo(
  range: Range,
  annotation: Annotation,
  container: HTMLElement,
  onMemoOpen: (
    annotation: Annotation,
    position: { top: number; left: number }
  ) => void
) {
  const span = document.createElement("span");
  span.className = "annotation-memo-target";
  span.setAttribute("data-annotation-memo", annotation.id);

  const icon = document.createElement("button");
  icon.type = "button";
  icon.className = "annotation-memo-icon";
  icon.textContent = "✎";

  const openPopover = () => {
    const iconRect = icon.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    onMemoOpen(annotation, {
      top: iconRect.bottom - containerRect.top + 8,
      left: iconRect.left - containerRect.left + iconRect.width / 2,
    });
  };

  icon.addEventListener("mouseenter", openPopover);
  icon.addEventListener("click", (event) => {
    event.preventDefault();
    openPopover();
  });

  try {
    const fragment = range.extractContents();
    span.appendChild(fragment);
    span.appendChild(icon);
    range.insertNode(span);
  } catch {}
}
