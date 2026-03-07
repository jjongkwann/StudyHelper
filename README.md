# StudyHelper

AI 기반 간격 반복(Spaced Repetition) 학습 도구. 학습 자료를 임포트하면 AI가 챕터와 개념을 분석하고, 학습 → 퀴즈 → 복습 흐름을 제공합니다.

## 주요 기능

- **프로젝트 임포트** — 마크다운/텍스트 학습 자료를 업로드하면 AI가 자동으로 챕터·개념 구조화
- **학습 모드** — 개념별 AI 생성 설명, 핵심 포인트, 비유, 이해도 체크 질문
- **퀴즈** — Bloom's Taxonomy 기반 난이도별 문제 생성 및 AI 평가
- **간격 복습** — SM-2 알고리즘으로 복습 일정 자동 관리
- **적응형 UI** — 데스크톱 사이드바 / 모바일 하단 탭바 반응형 레이아웃

## 기술 스택

| 영역 | 기술 |
|------|------|
| Framework | Next.js 16, React 19 |
| DB | SQLite + Prisma ORM |
| AI | Claude API 또는 Claude CLI (`--print` 모드) |
| UI | Tailwind CSS 4, shadcn/ui, Lucide Icons |
| 기타 | Zod (스키마 검증), react-markdown (렌더링) |

## 아키텍처

```
src/
├── app/                    # Next.js App Router (페이지 + API)
│   ├── api/                # REST API 엔드포인트
│   │   ├── ai/             # learn, quiz, evaluate
│   │   ├── projects/       # CRUD, status, retry
│   │   └── progress/       # review items
│   └── projects/[slug]/    # 프로젝트 상세, 학습, 퀴즈, 복습 페이지
├── application/            # 비즈니스 로직 (서비스 계층)
├── core/                   # 타입, 인터페이스 정의
├── components/             # UI 컴포넌트
├── infrastructure/         # 외부 시스템 연동
│   ├── db/                 # Prisma 리포지토리
│   └── llm/                # LLM 게이트웨이, 프롬프트, 프로바이더
└── workflows/              # 임포트 워크플로우 엔진
```

## 시작하기

### 사전 요구사항

- Node.js 20+
- Claude CLI 설치 (CLI 모드 사용 시) 또는 Anthropic API 키

### 설치

```bash
npm install
npx prisma generate
npx prisma db push
```

### 환경 변수

`.env` 파일 설정:

```env
DATABASE_URL="file:./dev.db"

# AI Provider: "api" 또는 "cli"
AI_PROVIDER=cli

# API 모드 사용 시
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# CLI 모드 사용 시
CLAUDE_CLI_PATH=claude
```

### 실행

```bash
npm run dev
```

`http://localhost:3000`에서 접속.

### 학습 자료 준비

프로젝트 루트에 학습 자료 폴더를 만들고 마크다운 파일을 넣으세요:

```
my-study-material/
├── 01_introduction.md
├── 02_basics.md
└── 03_advanced.md
```

프로젝트 생성 시 폴더명을 `contentPath`로 지정하면 AI가 자동 분석합니다.

## 학습 흐름

1. **프로젝트 생성** → 학습 자료 임포트 (AI가 챕터·개념 자동 분류)
2. **학습** → 챕터별 개념을 순서대로 학습, 이해도 체크
3. **퀴즈** → 학습한 내용 기반 문제 풀기, AI 피드백
4. **복습** → SM-2 기반 간격 반복으로 장기 기억 정착
