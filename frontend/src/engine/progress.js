export const STORAGE_KEY = '2cool4school:v1'; // format compatible : les champs v2 ont des valeurs par défaut

export const DEFAULT_PROGRESS = {
  xp: 0,
  streak: 0,
  lastDay: null,
  skills: {}, // { [skillId]: { seen, days, goodDays, history, certified } }
  cards: {},  // { [questionId]: données SM-2 }
  qlog: {},   // { [questionId]: [{ t, v, f }] } journal des réponses (v = valeur 0..1, f = format)
  stats: { answered: 0, correct: 0 },
  prefs: { guided: true },                 // parcours guidé (verrouillages) ou apprentissage libre
  goals: { global: 5, subjects: {} },      // objectifs : nombre de compétences certifiées, maîtrise par matière
};

export function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const d = structuredClone(DEFAULT_PROGRESS);
    return {
      ...d,
      ...saved,
      stats: { ...d.stats, ...(saved.stats ?? {}) },
      prefs: { ...d.prefs, ...(saved.prefs ?? {}) },
      goals: { ...d.goals, ...(saved.goals ?? {}), subjects: saved.goals?.subjects ?? {} },
      qlog: saved.qlog ?? {},
      skills: saved.skills ?? {},
      cards: saved.cards ?? {},
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

/** Met à jour la série de jours consécutifs. */
export function touchStreak(p) {
  const today = new Date().toDateString();
  if (p.lastDay === today) return p;
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  return { ...p, streak: p.lastDay === yesterday ? p.streak + 1 : 1, lastDay: today };
}
