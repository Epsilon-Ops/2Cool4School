/**
 * Journal d'activité : nombre de réponses par jour (clé « AAAA-MM-JJ », heure locale).
 * Sert à la régularité, aux objectifs hebdomadaires et aux défis. Fonctions pures.
 */
export const DAY = 86400000;
export const MAX_ACTIVITY_DAYS = 400;
export const REGULAR_MIN_DAYS = 2; // une semaine est « régulière » avec au moins 2 jours d'activité

export function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Date locale à partir d'une clé « AAAA-MM-JJ ». */
const fromKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Clé du lundi de la semaine contenant `ts` (semaine ISO, lundi en premier). */
export function weekKey(ts = Date.now()) {
  const d = fromKey(dayKey(ts));
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return dayKey(d.getTime());
}

/** Nombre de jours entiers entre deux clés (b − a). */
export function daysBetween(a, b) {
  return Math.round((fromKey(b) - fromKey(a)) / DAY);
}

/** Ajoute une réponse au jour de `ts`. Renvoie un nouvel objet. */
export function addActivity(activity = {}, ts = Date.now()) {
  const key = dayKey(ts);
  const next = { ...activity, [key]: (activity[key] ?? 0) + 1 };
  const keys = Object.keys(next).sort();
  if (keys.length > MAX_ACTIVITY_DAYS) {
    for (const k of keys.slice(0, keys.length - MAX_ACTIVITY_DAYS)) delete next[k];
  }
  return next;
}

/** Dernier jour actif strictement avant `key` (ou null). */
export function lastActiveBefore(activity = {}, key) {
  const before = Object.keys(activity).filter((k) => k < key).sort();
  return before.length ? before[before.length - 1] : null;
}

/** Nombre de réponses sur la semaine contenant `ts`. */
export function weekAnswers(activity = {}, ts = Date.now()) {
  const wk = weekKey(ts);
  return Object.entries(activity).reduce((n, [k, v]) => (weekKey(fromKey(k).getTime()) === wk ? n + v : n), 0);
}

/** Réponses depuis le jour `startKey` inclus. */
export function answersSince(activity = {}, startKey) {
  return Object.entries(activity).reduce((n, [k, v]) => (k >= startKey ? n + v : n), 0);
}

/** Jours actifs depuis le jour `startKey` inclus. */
export function activeDaysSince(activity = {}, startKey) {
  return Object.keys(activity).filter((k) => k >= startKey).length;
}

/**
 * Semaines régulières : semaines comptant au moins REGULAR_MIN_DAYS jours actifs.
 * Les semaines sans activité ne retirent rien : elles ne sont simplement pas comptées.
 */
export function regularWeeks(activity = {}) {
  const perWeek = {};
  for (const k of Object.keys(activity)) {
    const wk = weekKey(fromKey(k).getTime());
    perWeek[wk] = (perWeek[wk] ?? 0) + 1;
  }
  return Object.values(perWeek).filter((days) => days >= REGULAR_MIN_DAYS).length;
}

/** Séquence des `n` dernières semaines (lundi, nombre de réponses), la plus ancienne en premier. */
export function weeklySeries(activity = {}, n = 12, ts = Date.now()) {
  const totals = {};
  for (const [k, v] of Object.entries(activity)) {
    const wk = weekKey(fromKey(k).getTime());
    totals[wk] = (totals[wk] ?? 0) + v;
  }
  const out = [];
  const thisWeek = fromKey(weekKey(ts));
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(thisWeek);
    d.setDate(d.getDate() - 7 * i);
    const key = dayKey(d.getTime());
    out.push({ week: key, count: totals[key] ?? 0 });
  }
  return out;
}

/** Nombre de réponses par jour sur les `n` derniers jours (le plus ancien en premier). */
export function dailySeries(activity = {}, n = 84, ts = Date.now()) {
  const out = [];
  const today = fromKey(dayKey(ts));
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dayKey(d.getTime());
    out.push({ day: key, count: activity[key] ?? 0 });
  }
  return out;
}
