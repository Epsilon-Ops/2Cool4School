/**
 * Progression des cours, calculée à partir de deux sources :
 *  - les notions consultées (progress.course[courseId][sectionId::terme] = true), à 0 % ou 100 % ;
 *  - la réussite aux questions liées à la sous-section (dernier résultat v, entre 0 et 1, par question).
 * Une sous-section vaut la moyenne de ces deux parts (une seule part si l'autre n'existe pas).
 */
export const noteKey = (sectionId, term) => `${sectionId}::${term}`;

export function notionPct(courseId, sectionId, term, progress) {
  return progress.course?.[courseId]?.[noteKey(sectionId, term)] ? 100 : 0;
}

/**
 * Une question compte comme réussie dès que sa dernière tentative est juste.
 * (Une bonne réponse en qualité 4 vaut 0,9 pour la maîtrise, mais elle doit suffire à valider le cours.)
 */
const isDone = (v) => (v > 0 ? 1 : 0);

/**
 * Part de réussite des questions d'une sous-section. Seules les questions jouables comptent
 * (`playable`, facultatif) : une question de brouillon ou absente ne peut jamais bloquer la validation.
 */
function questionScore(ids, progress, playable) {
  const list = playable ? (ids ?? []).filter((id) => playable.has(id)) : (ids ?? []);
  if (!list.length) return null;
  const sum = list.reduce((s, id) => {
    const ev = progress.qlog?.[id];
    return s + (ev?.length ? isDone(ev[ev.length - 1].v) : 0);
  }, 0);
  return sum / list.length;
}

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function sectionPct(courseId, section, progress, playable) {
  const parts = [];
  if (section.terms?.length) {
    const seen = section.terms.filter((t) => notionPct(courseId, section.id, t.term, progress) === 100).length;
    parts.push(seen / section.terms.length);
  }
  const q = questionScore(section.questionIds, progress, playable);
  if (q !== null) parts.push(q);
  return Math.round(100 * avg(parts));
}

export function coursePct(course, progress, playable) {
  return Math.round(avg(course.sections.map((s) => sectionPct(course.id, s, progress, playable))));
}

/** Pourcentage moyen d'un ensemble de cours (chapitre, matière). */
export function groupPct(courses, progress, playable) {
  return Math.round(avg(courses.map((c) => coursePct(c, progress, playable))));
}
