/**
 * Rubrique Streaks : séries de jours, tableau d'apprentissage par matière et par jour,
 * et ratios de progression depuis le début de la semaine, du mois, de l'année et depuis le début.
 *
 * Source : progress.journal (réponses par matière et par jour). Pour les données antérieures
 * à ce journal, il est reconstruit à partir du journal des réponses par question (qlog).
 */
import { dayKey, DAY, daysBetween } from './activity.js';

/** Journal utilisable : celui enregistré, ou reconstruit depuis qlog pour les anciennes données. */
export function journalOf(progress, bank) {
  if (Object.keys(progress.journal ?? {}).length) return progress.journal;
  const subjectOf = Object.fromEntries(bank.map((q) => [q.id, q.subjectId]));
  const out = {};
  for (const [qid, events] of Object.entries(progress.qlog ?? {})) {
    const sid = subjectOf[qid];
    if (!sid) continue;
    for (const e of events ?? []) {
      const key = dayKey(e.t);
      const day = (out[key] ??= {});
      const cur = day[sid] ?? { n: 0, ok: 0 };
      day[sid] = { n: cur.n + 1, ok: cur.ok + (e.v > 0 ? 1 : 0) };
    }
  }
  return out;
}

/** Jour précédent, au format « AAAA-MM-JJ ». */
function previousKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1).getTime());
}

/** Série de jours : en cours (aujourd'hui ou hier) et record. */
export function dayStreaks(activity = {}, now = Date.now()) {
  const days = new Set(Object.keys(activity).filter((k) => activity[k] > 0));
  let current = 0;
  let k = dayKey(now);
  if (!days.has(k)) k = previousKey(k);
  while (days.has(k)) {
    current++;
    k = previousKey(k);
  }
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  sorted.forEach((d, i) => {
    run = i > 0 && daysBetween(sorted[i - 1], d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return { current, best, active: days.size };
}

/** Début de période, à minuit local. */
export function periodStart(kind, now = Date.now()) {
  const d = new Date(now);
  if (kind === 'week') {
    const offset = (d.getDay() + 6) % 7;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset).getTime();
  }
  if (kind === 'month') return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  if (kind === 'year') return new Date(d.getFullYear(), 0, 1).getTime();
  return 0; // depuis le commencement
}

export const PERIODS = [
  ['week', 'Cette semaine'],
  ['month', 'Ce mois'],
  ['year', 'Cette année'],
  ['all', 'Depuis le début'],
];

/**
 * Gain de maîtrise d'une compétence depuis `start` : maîtrise actuelle − maîtrise juste avant `start`
 * (0 si la compétence n'avait pas été travaillée). Renvoie null si elle n'a pas été travaillée sur la période.
 */
function skillGain(rec, mastery, start) {
  const hist = rec?.history ?? [];
  if (!hist.some((h) => h.t >= start)) return null;
  const before = hist.filter((h) => h.t < start);
  const base = before.length ? before[before.length - 1].m : 0;
  return mastery - base;
}

/**
 * Tableau par période : pour chaque matière et pour le total, nombre de questions, réussite,
 * et progression (points de maîtrise gagnés en moyenne sur les compétences travaillées).
 */
export function periodTable(progress, bank, subjects, stats, now = Date.now()) {
  const journal = journalOf(progress, bank);
  const skillSubject = Object.fromEntries(bank.map((q) => [q.skill, q.subjectId]));
  const skills = Object.keys(progress.skills ?? {});
  const out = {};

  for (const [kind, label] of PERIODS) {
    const start = periodStart(kind, now);
    const from = dayKey(start);
    const bySubject = {};
    for (const sub of subjects) bySubject[sub.id] = { n: 0, ok: 0, gains: [] };

    for (const [day, subs] of Object.entries(journal)) {
      if (kind !== 'all' && day < from) continue;
      for (const [sid, v] of Object.entries(subs)) {
        if (!bySubject[sid]) bySubject[sid] = { n: 0, ok: 0, gains: [] };
        bySubject[sid].n += v.n;
        bySubject[sid].ok += v.ok;
      }
    }
    for (const id of skills) {
      const sid = skillSubject[id];
      const g = skillGain(progress.skills[id], stats.byId[id]?.mastery ?? 0, start);
      if (!sid || g === null) continue;
      bySubject[sid]?.gains.push(g);
    }

    const rows = {};
    const all = { n: 0, ok: 0, gains: [] };
    for (const [sid, v] of Object.entries(bySubject)) {
      rows[sid] = {
        n: v.n,
        ok: v.ok,
        pct: v.n ? Math.round((100 * v.ok) / v.n) : null,
        gain: v.gains.length ? Math.round(v.gains.reduce((a, b) => a + b, 0) / v.gains.length) : null,
      };
      all.n += v.n;
      all.ok += v.ok;
      all.gains.push(...v.gains);
    }
    rows.total = {
      n: all.n,
      ok: all.ok,
      pct: all.n ? Math.round((100 * all.ok) / all.n) : null,
      gain: all.gains.length ? Math.round(all.gains.reduce((a, b) => a + b, 0) / all.gains.length) : null,
    };
    out[kind] = { label, rows };
  }
  return out;
}

/**
 * Grille d'apprentissage : une ligne par matière, une colonne par jour sur `days` jours.
 * Chaque case donne le nombre de réponses de la matière ce jour-là.
 */
export function learningGrid(progress, bank, subjects, days = 84, now = Date.now()) {
  const journal = journalOf(progress, bank);
  const keys = [];
  const d = new Date(now);
  for (let i = days - 1; i >= 0; i--) {
    keys.push(dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - i).getTime()));
  }
  const rows = subjects.map((sub) => ({
    id: sub.id,
    name: sub.name,
    color: sub.color ?? '#1cb0f6',
    cells: keys.map((key) => {
      const v = journal[key]?.[sub.id];
      return { day: key, n: v?.n ?? 0, ok: v?.ok ?? 0 };
    }),
  }));
  return { keys, rows };
}
