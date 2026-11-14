export const STORAGE_KEY = '2cool4school:v1'; // format compatible : les champs ajoutés ont des valeurs par défaut

export const DEFAULT_PROGRESS = {
  xp: 0,
  streak: 0,
  lastDay: null,
  skills: {}, // { [skillId]: { seen, days, goodDays, history, certified } }
  cards: {},  // { [questionId]: données SM-2 }
  course: {}, // { [courseId]: { [sectionId::terme]: true } } notions consultées
  qlog: {},   // { [questionId]: [{ t, v, f }] } journal des réponses (v = valeur 0..1, f = format)
  stats: { answered: 0, correct: 0, run: 0, runBest: 0, recoveries: 0, comebacks: 0 },
  prefs: { guided: true },                 // parcours guidé (verrouillages) ou apprentissage libre
  goals: { global: 5, subjects: {} },      // objectifs : nombre de compétences certifiées, maîtrise par matière
  activity: {},       // { 'AAAA-MM-JJ': nombre de réponses } : régularité, objectifs, défis
  achievements: {},   // { [id]: { t, label, group, reward } } succès obtenus (historique)
  challenges: [],     // défis personnels : { id, title, kind, target, days, start, done? }
  weekly: { target: null }, // objectif hebdomadaire facultatif (nombre de réponses par semaine)
  weeklyMet: {},      // { [lundi AAAA-MM-JJ]: true } semaines où l'objectif a été atteint
  profile: { color: '#f85211', title: null, name: '' }, // personnalisation du profil
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
      course: saved.course ?? {},
      activity: saved.activity ?? {},
      achievements: saved.achievements ?? {},
      challenges: saved.challenges ?? [],
      weekly: { ...d.weekly, ...(saved.weekly ?? {}) },
      weeklyMet: saved.weeklyMet ?? {},
      profile: { ...d.profile, ...(saved.profile ?? {}) },
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
