import type { Card, ReviewQuality, ReviewResult } from '@/types/models';

const W = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102,
  0.5316, 1.0651, 0.0234, 1.616, 0.1544,
  1.0824, 1.9813, 0.0953, 0.2975, 2.2042,
  0.2407, 2.9466, 0.5034, 0.6567,
];

const REQUEST_RETENTION = 0.9;
const MAX_INTERVAL = 36500;
const MIN_INTERVAL = 1;

function easeToDifficulty(ease: number): number {
  return Math.max(1, Math.min(10, 11 - ease * 3));
}

function difficultyToEase(d: number): number {
  return Math.max(1.3, Math.min(3.0, (11 - d) / 3));
}

function stabilityToInterval(stability: number): number {
  const interval = stability * 9 * (1 / REQUEST_RETENTION - 1);
  return Math.max(MIN_INTERVAL, Math.min(MAX_INTERVAL, interval));
}

function retrievability(stability: number, elapsed: number): number {
  return Math.pow(1 + elapsed / (9 * stability), -1);
}

function qualityToGrade(q: ReviewQuality): number {
  switch (q) {
    case 'wrong': return 1;
    case 'hard': return 2;
    case 'good': return 3;
    case 'easy': return 4;
  }
}

function constrainDifficulty(d: number): number {
  return Math.max(1, Math.min(10, d));
}

function handleNewCard(quality: ReviewQuality, now: Date): ReviewResult {
  let initialStability: number;
  let difficulty = 5.0;

  if (quality === 'wrong') {
    return {
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      nextReviewDate: new Date(now.getTime() + 10 * 60 * 1000), // 10 min
    };
  }

  if (quality === 'hard') {
    initialStability = W[1];
    difficulty = 6.0;
  } else if (quality === 'good') {
    initialStability = W[2];
    difficulty = 5.0;
  } else {
    initialStability = W[3];
    difficulty = 4.0;
  }

  const interval = Math.round(stabilityToInterval(initialStability));
  return {
    easeFactor: difficultyToEase(difficulty),
    interval,
    repetitions: 1,
    nextReviewDate: new Date(now.getTime() + interval * 86400000),
  };
}

export function calculateNextReview(card: Card, quality: ReviewQuality): ReviewResult {
  const now = new Date();

  if (!card.next_review_date || card.repetitions === 0) {
    return handleNewCard(quality, now);
  }

  const stability = card.interval;
  const difficulty = easeToDifficulty(card.ease_factor);

  const nextReview = new Date(card.next_review_date);
  const elapsed = Math.max(0, Math.floor((now.getTime() - nextReview.getTime()) / 86400000));
  const R = retrievability(stability, elapsed);

  let newStability: number;
  let newDifficulty: number;
  let newRepetitions: number;

  if (quality === 'wrong') {
    newStability = Math.max(
      MIN_INTERVAL,
      W[11] * Math.pow(difficulty, -W[12]) * (Math.pow(stability + 1, W[13]) - 1) * Math.exp(0),
    );
    newDifficulty = constrainDifficulty(difficulty + W[7]);
    newRepetitions = 0;
  } else {
    const hardPenalty = quality === 'hard' ? W[15] : 1.0;
    const easyBonus = quality === 'easy' ? W[16] : 1.0;
    newStability =
      stability *
      (1 +
        Math.exp(W[8]) *
          (11 - difficulty) *
          Math.pow(stability, -W[9]) *
          (Math.exp((1 - R) * W[10]) - 1) *
          hardPenalty *
          easyBonus);
    const deltaD = -W[6] * (qualityToGrade(quality) - 3);
    newDifficulty = constrainDifficulty(difficulty + deltaD);
    newRepetitions = card.repetitions + 1;
  }

  const newInterval = Math.round(stabilityToInterval(newStability));
  return {
    easeFactor: difficultyToEase(newDifficulty),
    interval: newInterval,
    repetitions: newRepetitions,
    nextReviewDate: new Date(now.getTime() + newInterval * 86400000),
  };
}

export function formatInterval(interval: number): string {
  if (interval === 0) return '<10m';
  if (interval === 1) return '1d';
  if (interval < 30) return `${interval}d`;
  if (interval < 365) return `${Math.round(interval / 30)}mo`;
  return `${Math.round(interval / 365)}y`;
}

export function isCardDue(card: Card): boolean {
  if (!card.next_review_date) return true;
  return new Date(card.next_review_date) <= new Date();
}
