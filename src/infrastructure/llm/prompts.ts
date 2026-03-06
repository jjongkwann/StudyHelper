export const SYSTEM_PROMPT = `당신은 학습 도우미 AI입니다. 한국어로 답변합니다.
학습 과학(인지심리학) 원리를 적용하여 효과적인 학습을 돕습니다.
답변은 항상 JSON 형식으로 반환합니다.`;

export function organizeChaptersPrompt(
  syllabusContent: string,
  fileNames: string[]
): string {
  return `당신은 학습 커리큘럼 설계 전문가입니다.
아래의 목차(syllabus)와 사용 가능한 파일 목록을 분석하여, 효과적인 학습 순서로 챕터를 구성해주세요.

**목차:**
---
${syllabusContent}
---

**사용 가능한 파일 목록:**
${fileNames.map((f) => `- ${f}`).join("\n")}

**규칙:**
1. 목차의 대분류(운영체제, 데이터베이스, 네트워크 등)를 기반으로 챕터를 나누세요.
2. 각 챕터에 해당하는 파일들을 매핑하세요. 파일명은 정확히 일치해야 합니다.
3. 학습 효과를 고려한 순서(기초→심화)로 챕터와 파일을 정렬하세요.
4. 챕터에 속하지 않는 파일이 있으면 가장 적절한 챕터에 배치하세요.

다음 JSON 형식으로만 응답해주세요:
{
  "chapters": [
    {
      "title": "챕터 제목",
      "description": "이 챕터에서 다루는 내용 한 줄 요약",
      "order": 1,
      "files": ["파일명1.md", "파일명2.md"]
    }
  ]
}`;
}

export function analyzeConceptsPrompt(
  chapterTitle: string,
  fileContent: string
): string {
  return `다음 마크다운 콘텐츠를 분석하여 학습 가능한 개념(concept)들로 분해해주세요.
각 개념은 하나의 핵심 주제를 다루며, 블룸의 택소노미 레벨(1-6)을 지정해주세요.

챕터: ${chapterTitle}

마크다운 콘텐츠:
---
${fileContent}
---

**규칙:**
- 개념은 h2/h3 수준의 독립적인 학습 단위로 나누세요.
- 너무 잘게 쪼개지 말고, 하나의 개념이 1~3분 학습 분량이 되도록 하세요.
- bloomLevel: 해당 개념을 완전히 이해하려면 필요한 인지 수준
  (1=기억, 2=이해, 3=적용, 4=분석, 5=평가, 6=창조)

다음 JSON 형식으로만 응답해주세요:
{
  "concepts": [
    {
      "title": "개념 제목",
      "content": "해당 개념의 핵심 내용 요약 (마크다운, 원본 내용 기반)",
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
