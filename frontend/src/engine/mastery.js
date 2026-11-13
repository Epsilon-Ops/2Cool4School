/**
 * Maîtrise, confiance, certification et lacunes.
 *
 * Tout part du journal des réponses question par question (progress.qlog).
 * Un score par question tient compte de la récence et du nombre de réponses ;
 * la maîtrise d'une compétence est la somme de ces scores, rapportée à une
 * référence de 8 questions bien réussies (ou moins si la banque est plus petite).
 */
import { nextCard } from './srs.js';

export const LEVELS = [
  { min: 0, name: 'Débutant' },
  { min: 20, name: 'Novice' },
  { min: 40, name: 'Intermédiaire' },
  { min: 60, name: 'Avancé' },
  { min: 80, name: 'Expert' },
  { min: 95, name: 'Maître' }, // exige aussi la certification
];

export const PRACTICE_FORMATS = ['fill_blank', 'ordering'];
export const kindOf = (format) => (PRACTICE_FORMATS.includes(format) ? 'practice' : 'theory');

export const REFERENCE_COUNT = 8; // nombre de questions à réussir pour une maîtrise complète
export const EVIDENCE_FULL = 2;   // nombre de réponses par question pour une confiance pleine
export const GAP_BELOW = 50;      // lacune : maîtrise sous ce seuil...
export const GAP_MIN_EVENTS = 3;  // ...après au moins 3 réponses
export const UNLOCK = 50;         // seuil de déblocage des compétences suivantes
export const CERT = { mastery: 80, goodDays: 3, practice: 60 };
export const MAX_LOG = 20;
export const MAX_HISTORY = 40;
export const MAX_DAYS = 60;

const DAY = 86400000;
const today = () => new Date().toDateString();
const addDay = (arr = [], day) => (arr.includes(day) ? arr : [...arr, day].slice(-MAX_DAYS));

/** Valeur d'une réponse, entre 0 et 1. */
export function valueOfAnswer(ok, quality) {
  if (!ok) return 0;
  if (quality >= 5) return 1;
  if (quality >= 4) return 0.9;
  return 0.7;
}

/** Score d'une question : moyenne pondérée par la récence, pondérée par la preuve. */
function scoreOf(events) {
  if (!events.length) return null;
  let num = 0;
  let den = 0;
  let w = 1;
  for (let i = events.length - 1; i >= 0; i--) {
    num += w * events[i].v;
    den += w;
    w *= 0.7;
  }
  const evidence = Math.min(1, events.length / EVIDENCE_FULL);
  return (num / den) * evidence;
}

function masteryOf(questionIds, qlog, reference, kind) {
  if (reference <= 0) return 0;
  let sum = 0;
  for (const id of questionIds) {
    const events = (qlog[id] ?? []).filter((e) => !kind || kindOf(e.f) === kind);
    const s = scoreOf(events);
    if (s !== null) sum += s;
  }
  return 100 * Math.min(1, sum / reference);
}

/** Niveau de maîtrise. « Maître » exige la certification. */
export function levelOf(mastery, certified = false) {
  let lvl = LEVELS[0];
  for (const l of LEVELS) if (mastery >= l.min) lvl = l;
  if (lvl.name === 'Maître' && !certified) return LEVELS[4];
  return lvl;
}

export function confidenceLabel(c) {
  if (c < 40) return 'Faible';
  if (c < 75) return 'Moyenne';
  return 'Élevée';
}

/** Une question dont la dernière réponse était fausse (pour le mode « reprise »). */
export function lastWasFailed(qlog = {}, id) {
  const events = qlog[id];
  return Boolean(events?.length) && events[events.length - 1].v === 0;
}

/** Statistiques d'une compétence à partir de ses questions et de la progression. */
export function statsForSkill(skill, questions, progress) {
  const qlog = progress.qlog ?? {};
  const rec = progress.skills?.[skill.id] ?? {};
  const qids = questions.map((q) => q.id);
  const reference = Math.min(REFERENCE_COUNT, qids.length);
  const events = qids.reduce((n, id) => n + (qlog[id]?.length ?? 0), 0);
  const hasPractice = questions.some((q) => (q.formats ?? []).some((f) => PRACTICE_FORMATS.includes(f)));

  let mastery = masteryOf(qids, qlog, reference, null);
  let theory = masteryOf(qids, qlog, reference, 'theory');
  let practice = masteryOf(qids, qlog, reference, 'practice');
  // Données sauvegardées avant la v2 : on garde la maîtrise connue tant qu'il n'y a pas de nouvelles réponses.
  if (events === 0 && rec.mastery > 0) {
    mastery = theory = practice = rec.mastery;
  }

  const goodDays = rec.goodDays?.length ?? 0;
  const days = rec.days?.length ?? 0;
  const confidence = Math.round(
    100 * Math.min(1, events / 10) * (0.5 + 0.5 * Math.min(1, days / CERT.goodDays))
  );
  const certified = rec.certified ?? null;

  // Fraîcheur : temps écoulé depuis la dernière réponse sur la compétence.
  const times = qids.flatMap((id) => (qlog[id] ?? []).map((e) => e.t));
  const lastAt = times.length ? Math.max(...times) : null;
  const staleDays = lastAt ? Math.floor((Date.now() - lastAt) / DAY) : null;
  const risk = staleDays === null ? null : staleDays >= 14 ? 'Élevé' : staleDays >= 7 ? 'Moyen' : 'Faible';

  // Tendance : stagnation (5 derniers points quasi identiques) ou acquisition rapide (< 3 jours).
  const recent = (rec.history ?? []).slice(-5).map((h) => h.m);
  let trend = null;
  if (!certified && events >= 6 && recent.length === 5 && Math.max(...recent) - Math.min(...recent) <= 3 && mastery < CERT.mastery) {
    trend = 'stagnant';
  }
  if (certified && rec.history?.length && certified - rec.history[0].t < 3 * DAY) trend = 'fast';

  return {
    id: skill.id,
    qCount: qids.length,
    events,
    mastery: Math.round(mastery),
    theory: Math.round(theory),
    practice: Math.round(practice),
    hasPractice,
    confidence,
    confidenceLabel: confidenceLabel(confidence),
    level: levelOf(mastery, Boolean(certified)),
    certified,
    goodDays,
    gap: events >= GAP_MIN_EVENTS && mastery < GAP_BELOW && !certified,
    seen: rec.seen ?? 0,
    history: rec.history ?? [],
    paused: Boolean(rec.paused),
    lastAt,
    staleDays,
    risk,
    trend,
    blocks: [],
  };
}

/**
 * Statistiques de toutes les compétences, plus les lacunes et les compétences bloquantes
 * (une lacune dont dépend une compétence pas encore certifiée).
 */
export function buildStats(skills, bank, progress) {
  const bySkill = {};
  for (const q of bank) (bySkill[q.skill] ??= []).push(q);

  const byId = {};
  for (const s of skills) byId[s.id] = statsForSkill(s, bySkill[s.id] ?? [], progress);

  const dependents = {};
  for (const s of skills) for (const p of s.prereq ?? []) (dependents[p] ??= []).push(s.id);
  for (const id of Object.keys(byId)) {
    byId[id].blocks = (dependents[id] ?? []).filter((d) => byId[d]?.qCount > 0 && !byId[d].certified);
  }

  const gaps = Object.values(byId).filter((x) => x.gap).map((x) => x.id);
  const blockers = gaps.filter((id) => byId[id].blocks.length > 0);
  return { byId, gaps, blockers };
}

/** Applique le résultat d'une réponse : SRS, journal, historique, certification, XP. */
export function recordAnswer(progress, bank, q, ok, quality, format) {
  const p = structuredClone(progress);
  const now = Date.now();

  p.cards[q.id] = nextCard(p.cards[q.id], quality, now);

  const log = p.qlog[q.id] ?? [];
  p.qlog[q.id] = [...log, { t: now, v: valueOfAnswer(ok, quality), f: format ?? 'single_choice' }].slice(-MAX_LOG);

  const day = today();
  const rec = { ...(p.skills[q.skill] ?? {}) };
  rec.seen = (rec.seen ?? 0) + 1;
  rec.days = addDay(rec.days, day);
  if (ok) rec.goodDays = addDay(rec.goodDays, day);
  p.skills[q.skill] = rec;

  const skillQuestions = bank.filter((x) => x.skill === q.skill);
  const s = statsForSkill({ id: q.skill }, skillQuestions, p);

  rec.history = [...(rec.history ?? []), { t: now, m: s.mastery }].slice(-MAX_HISTORY);
  const practiceOk = !s.hasPractice || s.practice >= CERT.practice;
  if (!rec.certified && s.mastery >= CERT.mastery && (rec.goodDays?.length ?? 0) >= CERT.goodDays && practiceOk) {
    rec.certified = now;
  }

  if (ok) p.xp += 10 + q.difficulty * 5;
  p.stats.answered += 1;
  if (ok) p.stats.correct += 1;
  return p;
}
