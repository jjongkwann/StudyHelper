export const SYSTEM_PROMPT = `당신은 학습 도우미 AI입니다. 한국어로 답변합니다.
학습 과학(인지심리학) 원리를 적용하여 효과적인 학습을 돕습니다.
답변은 항상 JSON 형식으로 반환합니다.`;

export function chapterAnalysisPrompt(content: string): string {
  return `다음 마크다운 콘텐츠를 분석하여 학습 가능한 개념(concept)들로 분해해주세요.
각 개념은 하나의 핵심 주제를 다루며, 블룸의 택소노미 레벨(1-6)을 지정해주세요.

마크다운 콘텐츠:
---
${content}
---

다음 JSON 형식으로 응답해주세요:
{
  "concepts": [
    {
      "title": "개념 제목",
      "content": "해당 개념의 핵심 내용 (마크다운)",
      "bloomLevel": 1,
      "order": 1
    }
  ]
}`;
}

export function learnConceptPrompt(concept: string, context: string): string {
  return `다음 개념을 학습자에게 설명해주세요. 핵심을 구조적으로 정리하고, 실제 사례나 비유를 활용해주세요.

개념:
---
${concept}
---

전체 챕터 맥락:
---
${context}
---

다음 JSON 형식으로 응답해주세요:
{
  "explanation": "구조화된 설명 (마크다운)",
  "keyPoints": ["핵심 포인트 1", "핵심 포인트 2"],
  "analogy": "이해를 돕는 비유 (선택)",
  "checkQuestion": {
    "question": "이해도 확인 질문",
    "expectedAnswer": "기대 답변 요지"
  }
}`;
}

export function generateQuizPrompt(
  concepts: { title: string; content: string }[],
  bloomLevel: number,
  count: number
): string {
  const bloomLabels: Record<number, string> = {
    1: "기억(Remember) - 정의, 나열, 용어 확인",
    2: "이해(Understand) - 자신의 말로 설명, 비교",
    3: "적용(Apply) - 특정 상황에 지식 적용",
    4: "분석(Analyze) - 원인 분석, 구조 파악, 트레이드오프",
    5: "평가(Evaluate) - 대안 비교 판단, 최적 선택 근거",
    6: "창조(Create) - 새로운 설계, 문제 해결 방안 제시",
  };

  const conceptList = concepts
    .map((c) => `### ${c.title}\n${c.content}`)
    .join("\n\n");

  return `다음 학습 내용을 기반으로 퀴즈 문제 ${count}개를 생성해주세요.

블룸 택소노미 레벨: ${bloomLevel} - ${bloomLabels[bloomLevel] || ""}

학습 내용:
---
${conceptList}
---

다음 JSON 형식으로 응답해주세요:
{
  "questions": [
    {
      "question": "문제 내용",
      "bloomLevel": ${bloomLevel},
      "conceptTitle": "관련 개념 제목",
      "hints": ["힌트1 (선택)"]
    }
  ]
}`;
}

export function evaluateAnswerPrompt(
  question: string,
  conceptContent: string,
  userAnswer: string
): string {
  return `학습자의 답변을 평가해주세요.

문제:
${question}

참고 학습 내용:
---
${conceptContent}
---

학습자 답변:
${userAnswer}

다음 JSON 형식으로 응답해주세요:
{
  "score": 0~5 사이 정수,
  "feedback": "구체적인 피드백 (잘한 점 + 부족한 점)",
  "correctAnswer": "모범 답안",
  "weakPoints": ["부족한 개념1", "부족한 개념2"]
}

채점 기준:
- 5: 완벽하게 정확하고 깊이 있는 답변
- 4: 대부분 정확, 약간의 보완 필요
- 3: 핵심은 이해했으나 중요한 부분 누락
- 2: 부분적으로만 정확
- 1: 방향은 맞으나 대부분 부정확
- 0: 완전히 틀리거나 답변 없음`;
}
