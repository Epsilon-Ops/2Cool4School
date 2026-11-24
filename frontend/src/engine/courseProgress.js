/**
 * Pourcentage d'un cours : part des questions du cours réellement acquises.
 *
 * Une question est acquise si ses réponses VÉRIFIÉES (correction automatique) suffisent à
 * sa maîtrise (score ≥ 80 %, soit au moins deux réussites récentes). Les auto-évaluations ne comptent pas,
 * et consulter une notion ne fait pas progresser le pourcentage : seule la pratique vérifiée le fait.
 */
import { scoreOf } from './mastery.js';

export const ACQUIRED = 0.8;   // score minimal pour qu'une question soit acquise
export const noteKey = (sectionId, term) => `${sectionId}::${term}`;

/** Notion consultée (« lue »). Affichée, mais sans effet sur le pourcentage. */
export function notionRead(courseId, sectionId, term, progress) {
  return Boolean(progress.course?.[courseId]?.[noteKey(sectionId, term)]);
}

/** Une question est-elle acquise ? Seules les réponses vérifiées comptent. */
export function isAcquired(qid, progress) {
  const verified = (progress.qlog?.[qid] ?? []).filter((e) => !e.s);
  const s = scoreOf(verified);
  return s !== null && s >= ACQUIRED;
}

/** Questions jouables (hors brouillons) d'une liste d'identifiants. */
function playableIds(ids, playable) {
  const unique = [...new Set(ids ?? [])];
  return playable ? unique.filter((id) => playable.has(id)) : unique;
}

/** { done, total } pour une liste de questions. */
export function countAcquired(ids, progress, playable) {
  const list = playableIds(ids, playable);
  return { done: list.filter((id) => isAcquired(id, progress)).length, total: list.length };
}

const pctOf = ({ done, total }) => (total ? Math.round((100 * done) / total) : 0);

export const sectionPct = (courseId, section, progress, playable) =>
  pctOf(countAcquired(section.questionIds, progress, playable));

export function coursePct(course, progress, playable) {
  return pctOf(countAcquired(course.sections.flatMap((s) => s.questionIds ?? []), progress, playable));
}

/** Pourcentage d'un ensemble de cours (chapitre, matière) : questions acquises sur questions totales. */
export function groupPct(courses, progress, playable) {
  return pctOf(countAcquired(courses.flatMap((c) => c.sections.flatMap((s) => s.questionIds ?? [])), progress, playable));
}
