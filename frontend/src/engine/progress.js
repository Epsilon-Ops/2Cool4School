import { nextCard } from './srs.js';

export const STORAGE_KEY = '2cool4school:v1';

export const DEFAULT_PROGRESS = {
  xp: 0,
  streak: 0,
  lastDay: null,
  skills: {}, // { [skillId]: { mastery: 0-100, seen: n } }
  cards: {},  // { [questionId]: données SM-2 }
  stats: { answered: 0, correct: 0 }, // tentatives totales et réussies
};

export function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      ...structuredClone(DEFAULT_PROGRESS),
      ...saved,
      stats: { ...DEFAULT_PROGRESS.stats, ...(saved.stats ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULT_PROGRESS);
  }
}

export function saveProgress(p) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* stockage plein ou désactivé : on ignore */
  }
}

/** Libellé de maîtrise, indépendant des points gagnés. */
export function levelOf(mastery) {
  if (mastery >= 80) return 'Maîtrise';
  if (mastery >= 50) return 'Application';
  if (mastery >= 25) return 'Compréhension';
  return 'Découverte';
}

/** Met à jour la série de jours consécutifs. */
export function touchStreak(p) {
  const today = new Date().toDateString();
  if (p.lastDay === today) return p;
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  return { ...p, streak: p.lastDay === yesterday ? p.streak + 1 : 1, lastDay: today };
}

/** Applique le résultat d'une réponse : SRS, maîtrise de la compétence, XP. */
export function applyAnswer(progress, q, ok, quality) {
  const p = structuredClone(progress);

  p.cards[q.id] = nextCard(p.cards[q.id], quality);

  const s = p.skills[q.skill] ?? { mastery: 0, seen: 0 };
  const delta = ok ? Math.round(3 + quality * 1.5) : -6;
  s.mastery = Math.max(0, Math.min(100, s.mastery + delta));
  s.seen += 1;
  p.skills[q.skill] = s;

  if (ok) p.xp += 10 + q.difficulty * 5;
  p.stats.answered += 1;
  if (ok) p.stats.correct += 1;
  return p;
}
