export const SYSTEM_PROMPT = `당신은 학습 도우미 AI입니다. 한국어로 답변합니다.
학습 과학(인지심리학) 원리를 적용하여 효과적인 학습을 돕습니다.
제공된 원문 내용을 최우선 근거로 사용합니다. 원문에 없는 사실을 단정하지 않습니다.
답변은 항상 JSON 형식으로 반환합니다. 설명 없이 JSON만 출력합니다.`;

// ---------------------------------------------------------------------------
// planChapters: 3-step prompt chain
// ---------------------------------------------------------------------------

/** Chain Step 1: Extract topic categories from syllabus headings */
export function extractTopicsPrompt(syllabusHeadings: string): string {
  return `<task>
목차의 헤딩 구조에서 학습 주제(대분류)를 추출하라.
</task>

<input>
<syllabus_headings>
${syllabusHeadings}
</syllabus_headings>
</input>

<rules>
1. h2(##) 수준의 대분류만 추출한다.
2. 각 주제에 연관된 키워드를 목차에서 찾아 나열한다.
3. 학습 순서(기초→심화)로 정렬한다.
</rules>

<output_format>
{
  "topics": [
    { "title": "주제명", "keywords": ["키워드1", "키워드2"], "order": 1 }
  ]
}
</output_format>

<important>설명 없이 JSON만 출력하라.</important>`;
}

/** Chain Step 2: Classify files into topics */
export function classifyFilesPrompt(
  topicsJson: string,
  fileNames: string[]
): string {
  return `<task>
파일명을 분석하여 각 파일이 어느 주제에 속하는지 분류하라.
</task>

<input>
<topics>
${topicsJson}
</topics>

<files>
${fileNames.map((f) => `- ${f}`).join("\n")}
</files>
</input>

<rules>
1. 모든 파일은 정확히 1개 주제에 배정한다.
2. 파일명은 입력과 정확히 일치해야 한다. 변경하지 마라.
3. 어떤 주제에도 맞지 않으면 가장 가까운 주제에 배치한다.
</rules>

<output_format>
{
  "assignments": [
    { "file": "정확한파일명.md", "topic": "주제명" }
  ]
}
</output_format>

<important>설명 없이 JSON만 출력하라.</important>`;
}

/** Chain Step 3: Build final chapters from topics + file assignments */
export function buildChaptersPrompt(
  topicsJson: string,
  assignmentsJson: string
): string {
  return `<task>
주제 목록과 파일 분류 결과를 합쳐 최종 학습 챕터를 구성하라.
</task>

<input>
<topics>
${topicsJson}
</topics>

<file_assignments>
${assignmentsJson}
</file_assignments>
</input>

<rules>
1. 모든 파일은 정확히 1개 챕터에 속한다.
2. 파일명은 입력과 정확히 일치해야 한다.
3. 학습 순서는 기초→심화다.
4. 설명(description)은 한 줄로 작성한다.
</rules>

<output_format>
{
  "chapters": [
    {
      "title": "챕터 제목",
      "description": "이 챕터에서 다루는 내용 한 줄 요약",
      "order": 1,
      "files": ["exact-file-name.md"]
    }
  ]
}
</output_format>

<important>설명 없이 JSON만 출력하라.</important>`;
}

// Legacy single-shot prompt (kept as fallback reference)
export function organizeChaptersPrompt(
  syllabusContent: string,
  fileNames: string[]
): string {
  return `<task>
목차와 파일 목록을 분석하여 학습 챕터를 구성하라.
</task>

<input>
<syllabus>
${syllabusContent}
</syllabus>

<files>
${fileNames.map((f) => `- ${f}`).join("\n")}
</files>
</input>

<rules>
1. 목차의 대분류를 기반으로 챕터를 나눈다.
2. 각 챕터에 해당하는 파일들을 매핑한다. 파일명은 정확히 일치해야 한다.
3. 학습 효과를 고려한 순서(기초→심화)로 정렬한다.
4. 챕터에 속하지 않는 파일이 있으면 가장 적절한 챕터에 배치한다.
</rules>

<output_format>
{
  "chapters": [
    {
      "title": "챕터 제목",
      "description": "이 챕터에서 다루는 내용 한 줄 요약",
      "order": 1,
      "files": ["파일명1.md", "파일명2.md"]
    }
  ]
}
</output_format>

<important>설명 없이 JSON만 출력하라.</important>`;
}

// ---------------------------------------------------------------------------
// analyzeChapter: 2-step prompt chain (multi-file chapters)
// ---------------------------------------------------------------------------

/** Build XML file blocks from parsed file contents */
export function buildFileBlocks(
  files: { name: string; content: string }[]
): string {
  return files
    .map(
      (f, i) =>
        `<file index="${i}" name="${f.name}">\n${f.content}\n</file>`
    )
    .join("\n\n");
}

/** Chain Step 1: Analyze structure and determine learning order */
export function structureConceptsPrompt(
  chapterTitle: string,
  fileBlocks: string
): string {
  return `<task>
챕터 "${chapterTitle}"에 속한 파일들의 섹션 구조를 분석하고 학습 순서를 결정하라.
</task>

<input>
${fileBlocks}
</input>

<rules>
1. 각 파일의 h2(##), h3(###) 섹션을 식별한다.
2. 같은 제목이 여러 파일에 있으면 파일 맥락(파일명, 주변 내용)으로 구분한다.
3. 순서 원칙: 개요/정의 → 핵심 개념 → 세부/심화 → 응용/사례
4. 원문 등장 순서를 기본으로 하되, 명백한 선수지식 관계만 재배치한다.
5. 짧은 섹션(1-2줄)은 mergeWithPrevious: true로 표시하여 인접 섹션과 병합한다.
6. bloomLevel: 해당 섹션의 인지 수준 (1=기억, 2=이해, 3=적용, 4=분석, 5=평가, 6=창조)
</rules>

<output_format>
{
  "outline": [
    {
      "fileIndex": 0,
      "sectionTitle": "섹션 제목",
      "learningOrder": 1,
      "bloomLevel": 2,
      "mergeWithPrevious": false
    }
  ]
}
</output_format>

<important>설명 없이 JSON만 출력하라.</important>`;
}

/** Chain Step 2: Generate concepts based on outline */
export function generateConceptsPrompt(
  chapterTitle: string,
  fileBlocks: string,
  outlineJson: string
): string {
  return `<task>
아래 outline의 learningOrder 순서대로 각 섹션에서 학습 개념(concept)을 추출하라.
</task>

<input>
<chapter_title>${chapterTitle}</chapter_title>

<outline>
${outlineJson}
</outline>

${fileBlocks}
</input>

<rules>
1. outline의 learningOrder 순서대로 개념을 생성하고, order = learningOrder로 설정한다.
2. mergeWithPrevious: true인 섹션은 직전 섹션과 합쳐 하나의 개념으로 만든다.
3. 각 개념의 content는 해당 섹션 원문 기반 핵심 요약 (마크다운)이다.
4. bloomLevel은 outline 값을 참고하되, 내용에 맞게 조정할 수 있다.
5. 하나의 개념이 1~3분 학습 분량이 되도록 한다.
6. 너무 잘게 쪼개지 말고, h2/h3 수준의 독립적인 학습 단위로 나눈다.
</rules>

<output_format>
{
  "concepts": [
    {
      "title": "개념 제목",
      "content": "해당 개념의 핵심 내용 요약 (마크다운, 원본 내용 기반)",
      "bloomLevel": 2,
      "order": 1
    }
  ]
}
</output_format>

<important>설명 없이 JSON만 출력하라.</important>`;
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

규칙:
- 설명은 반드시 제공된 개념/맥락을 근거로 작성하세요.
- 원문에 없는 세부 사실은 추가하지 마세요.
- 비유는 선택 사항이며, 비유와 원문 기반 설명을 섞지 말고 분리해서 제시하세요.
- checkQuestion은 제공된 원문만으로 답할 수 있는 질문이어야 합니다.
- 수식, 시간복잡도, 수학 표현은 반드시 LaTeX로 작성하세요. 인라인은 $...$, 블록은 $$...$$를 사용하세요. 예: $O(V+E)$, $O((V+E)\\log V)$, $\\alpha(n)$

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

규칙:
- 문제는 반드시 제공된 학습 내용만으로 풀 수 있어야 합니다.
- conceptTitle은 반드시 입력된 개념 제목 중 하나와 정확히 일치해야 합니다.
- 각 문제는 암기형 문장 복사가 아니라 이해/적용을 확인할 수 있게 작성하세요.
- 중복 문제를 만들지 마세요.

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

규칙:
- 제공된 참고 학습 내용만 근거로 평가하세요.
- 표현이 달라도 의미가 맞으면 정답으로 인정하세요.
- 부분 정답은 부분 점수로 반영하세요.
- 근거가 부족하면 감점 이유를 feedback에 명확히 적으세요.

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
