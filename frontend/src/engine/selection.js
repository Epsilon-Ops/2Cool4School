import { shuffle, weightedSample } from './random.js';

/**
 * Stratégies d'ordre des questions :
 * - random       : aléatoire complet
 * - weighted     : les lacunes et les questions dues reviennent davantage
 * - unseen       : d'abord les questions jamais vues
 * - progressive  : tirage aléatoire puis tri par difficulté croissante
 */
export function pickQuestions(bank, { skill, count = 5, strategy = 'weighted', progress }) {
  const pool = bank.filter((q) => !skill || q.skill === skill);
  const cards = progress?.cards ?? {};
  const now = Date.now();

  if (strategy === 'random') {
    return shuffle(pool).slice(0, count);
  }

  if (strategy === 'unseen') {
    const unseen = shuffle(pool.filter((q) => !cards[q.id]));
    const seen = shuffle(pool.filter((q) => cards[q.id]));
    return [...unseen, ...seen].slice(0, count);
  }

  const weights = pool.map((q) => {
    const c = cards[q.id];
    if (!c) return 2;
    let w = 1;
    if (c.dueAt <= now) w += 2;
    if (c.lastQuality !== undefined && c.lastQuality < 3) w += 3;
    return w;
  });
  const picked = weightedSample(pool, weights, count);

  if (strategy === 'progressive') {
    return picked.sort((a, b) => a.difficulty - b.difficulty);
  }
  return picked;
}
