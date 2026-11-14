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

function questionScore(ids, progress) {
  if (!ids?.length) return null;
  const sum = ids.reduce((s, id) => {
    const ev = progress.qlog?.[id];
    return s + (ev?.length ? ev[ev.length - 1].v : 0);
  }, 0);
  return sum / ids.length;
}

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function sectionPct(courseId, section, progress) {
  const parts = [];
  if (section.terms?.length) {
    const seen = section.terms.filter((t) => notionPct(courseId, section.id, t.term, progress) === 100).length;
    parts.push(seen / section.terms.length);
  }
  const q = questionScore(section.questionIds, progress);
  if (q !== null) parts.push(q);
  return Math.round(100 * avg(parts));
}

export function coursePct(course, progress) {
  return Math.round(avg(course.sections.map((s) => sectionPct(course.id, s, progress))));
}

/** Pourcentage moyen d'un ensemble de cours (chapitre, matière). */
export function groupPct(courses, progress) {
  return Math.round(avg(courses.map((c) => coursePct(c, progress))));
}
