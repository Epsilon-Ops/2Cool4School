/**
 * Actions manuelles sur une compétence : réinitialiser, mettre en pause, marquer comme acquise.
 * Chaque fonction renvoie une nouvelle progression (l'objet d'origine n'est pas modifié).
 */
export function resetSkill(progress, bank, skillId) {
  const p = structuredClone(progress);
  for (const q of bank) {
    if (q.skill !== skillId) continue;
    delete p.qlog[q.id];
    delete p.cards[q.id];
  }
  p.skills[skillId] = {};
  return p;
}

export function togglePause(progress, skillId) {
  const p = structuredClone(progress);
  const rec = p.skills[skillId] ?? {};
  p.skills[skillId] = { ...rec, paused: !rec.paused };
  return p;
}

export function markAcquired(progress, skillId) {
  const p = structuredClone(progress);
  const rec = p.skills[skillId] ?? {};
  p.skills[skillId] = { ...rec, certified: rec.certified ?? Date.now(), manual: true, paused: false };
  return p;
}
