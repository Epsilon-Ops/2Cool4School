import { shuffle, weightedSample } from './random.js';
import { lastWasFailed } from './mastery.js';

/**
 * Stratégies d'ordre :
 * - random       : aléatoire complet
 * - weighted     : les lacunes et les questions dues reviennent davantage
 * - unseen       : d'abord les questions jamais vues
 * - progressive  : tirage pondéré puis tri par difficulté croissante
 *
 * Modes de sélection :
 * - skill        : questions de la compétence (ou de toute la banque si pas de compétence)
 * - mix          : mélange de tous les chapitres, sans tenir compte de la compétence
 * - reprise      : questions dont la dernière réponse était fausse
 * - assimilation : questions des compétences identifiées comme lacunes (gapIds)
 */
export function pickQuestions(
  bank,
  { skill, count = 5, strategy = 'weighted', progress, mode = 'skill', gapIds } = {}
) {
  const cards = progress?.cards ?? {};
  const now = Date.now();

  const scoped = mode === 'mix' || !skill ? bank : bank.filter((q) => q.skill === skill);
  const pool =
    mode === 'assimilation' ? scoped.filter((q) => gapIds?.has(q.skill))
    : mode === 'reprise' ? scoped.filter((q) => lastWasFailed(progress?.qlog, q.id))
    : scoped;
  if (pool.length === 0) return [];

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

/** Questions dont la révision est due (SM-2 : dueAt déjà dépassée). */
export function dueQuestions(bank, progress, now = Date.now()) {
  const cards = progress?.cards ?? {};
  return bank.filter((q) => cards[q.id] && cards[q.id].dueAt <= now);
}
