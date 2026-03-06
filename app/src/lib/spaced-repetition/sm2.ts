/**
 * SM-2 Spaced Repetition Algorithm
 *
 * Based on: https://en.wikipedia.org/wiki/SuperMemo#SM-2
 *
 * quality: 0-5 (답변 품질)
 *   0-2: 오답 (repetitions 리셋)
 *   3: 맞았지만 어려움
 *   4: 맞음
 *   5: 완벽
 */

export interface SM2Input {
  quality: number; // 0-5
  repetitions: number;
  easeFactor: number;
  intervalDays: number;
}

export interface SM2Result {
  repetitions: number;
  easeFactor: number;
  intervalDays: number;
  nextReviewAt: Date;
}

export function calculateSM2(input: SM2Input): SM2Result {
  const { quality, repetitions, easeFactor, intervalDays } = input;

  let newRepetitions: number;
  let newInterval: number;
  let newEaseFactor: number;

  // EF 계산 (quality와 무관하게 항상 업데이트)
  newEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (newEaseFactor < 1.3) newEaseFactor = 1.3;

  if (quality < 3) {
    // 오답: repetitions 리셋, 처음부터
    newRepetitions = 0;
    newInterval = 1;
  } else {
    // 정답
    newRepetitions = repetitions + 1;
    if (newRepetitions === 1) {
      newInterval = 1;
    } else if (newRepetitions === 2) {
      newInterval = 3;
    } else {
      newInterval = Math.round(intervalDays * newEaseFactor);
    }
  }

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + newInterval);
  nextReviewAt.setHours(0, 0, 0, 0);

  return {
    repetitions: newRepetitions,
    easeFactor: Math.round(newEaseFactor * 100) / 100,
    intervalDays: newInterval,
    nextReviewAt,
  };
}

/** ease_factor < 1.5 이거나 연속 2회 오답이면 재학습 필요 */
export function needsRelearning(easeFactor: number, consecutiveFails: number): boolean {
  return easeFactor < 1.5 || consecutiveFails >= 2;
}

/** quality 점수를 0-5 score로 변환 */
export function scoreToQuality(score: number): number {
  // score 0-5를 그대로 quality로 사용
  return Math.max(0, Math.min(5, score));
}
