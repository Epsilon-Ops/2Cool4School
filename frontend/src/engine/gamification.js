/**
 * Gamification : succès et badges, collections, titres, niveau global, défis, objectifs,
 * déblocage de domaines et récompenses de régularité.
 *
 * Tout est dérivé de la progression (et des statistiques de compétences) : seuls les
 * succès obtenus, les défis terminés et les semaines atteintes sont stockés, avec leur date.
 * Les pauses ne font jamais perdre de points, de succès ni de régularité.
 */
import titles from '../data/utils/titles.json';
import { buildStats, levelOf, LEVELS } from './mastery.js';
import { coursePct } from './courseProgress.js';
import { FORMAT_LABELS } from './formats.js';
import {
  DAY, dayKey, weekKey, weekAnswers, answersSince, activeDaysSince, regularWeeks,
} from './activity.js';

/** Nombre de compétences certifiées nécessaires pour ouvrir un domaine (parcours guidé). */
export const DOMAIN_REQUIREMENTS = { lifapc: 0, reseaux: 0, liflc: 2, bdd: 3 };

/** Palette du profil : chaque couleur se débloque avec un nombre de succès obtenus. */
export const PALETTE = [
  { color: '#f85211', name: 'Orange', need: 0 },
  { color: '#1cb0f6', name: 'Bleu', need: 0 },
  { color: '#ce82ff', name: 'Violet', need: 5 },
  { color: '#58cc02', name: 'Vert', need: 10 },
  { color: '#ffc800', name: 'Jaune', need: 20 },
  { color: '#ff86d0', name: 'Rose', need: 30 },
];

export const WEEKLY_TARGETS = [null, 10, 25, 50];

export const CHALLENGE_TEMPLATES = [
  { title: '30 réponses en 7 jours', kind: 'answers', target: 30, days: 7 },
  { title: 'Certifier 2 compétences en 14 jours', kind: 'certs', target: 2, days: 14 },
  { title: 'Être actif 5 jours en 7', kind: 'days', target: 5, days: 7 },
];

export const GROUPS = {
  reussite: 'Réussite',
  perseverance: 'Persévérance',
  polyvalence: 'Polyvalence',
  maitrise: 'Maîtrise approfondie',
  competence: 'Compétences précises',
  projet: 'Projets réalisés',
  collection: 'Collections de certifications',
  regularite: 'Régularité',
  objectif: 'Objectif hebdomadaire',
  defi: 'Défis personnels',
  domaine: 'Domaines',
};

/** Titre associé à une compétence certifiée. */
export const titleOf = (skill) => titles[skill.id] ?? `Certifié·e en ${skill.short ?? skill.name}`;

/** Compétences à plat, avec la matière d'origine. */
export function flatSkills(subjects) {
  return subjects.flatMap((sub) => sub.skills.map((s) => ({ ...s, subjectId: sub.id, subjectName: sub.name })));
}

export function domainOpen(subjectId, certCount, progress) {
  const req = DOMAIN_REQUIREMENTS[subjectId] ?? 0;
  return req === 0 || certCount >= req || Boolean(progress.achievements?.[`domain:${subjectId}`]);
}

/**
 * Contexte de calcul : statistiques, compteurs et jeux de matières.
 * Chaque valeur est recalculée à partir de la progression courante.
 */
export function contextOf(progress, subjects, bank, courses, now = Date.now()) {
  const skills = flatSkills(subjects);
  const stats = buildStats(skills, bank, progress);
  const byId = stats.byId;
  const playable = skills.filter((s) => byId[s.id]?.qCount > 0);
  const certified = playable.filter((s) => byId[s.id].certified);
  const certCount = certified.length;
  const subjectOfSkill = Object.fromEntries(skills.map((s) => [s.id, s.subjectId]));

  const subjectsAnswered = new Set();
  const formatsUsed = new Set();
  for (const q of bank) {
    const ev = progress.qlog?.[q.id];
    if (!ev?.length) continue;
    subjectsAnswered.add(q.subjectId);
    for (const e of ev) formatsUsed.add(e.f);
  }
  const subjectsCertified = new Set(certified.map((s) => subjectOfSkill[s.id]));

  const masterCount = certified.filter((s) => byId[s.id].level.name === 'Maître').length;
  const theoryPractice = certified.filter((s) => {
    const x = byId[s.id];
    return x.hasPractice && x.theory >= 80 && x.practice >= 80;
  }).length;

  const avgMastery = playable.length
    ? playable.reduce((a, s) => a + byId[s.id].mastery, 0) / playable.length
    : 0;
  const allCertified = playable.length > 0 && certCount === playable.length;
  const level = levelOf(avgMastery, allCertified);
  const idx = LEVELS.findIndex((l) => l.name === level.name);
  const knowledge = {
    avg: Math.round(avgMastery),
    level,
    next: LEVELS[idx + 1] ?? null,
  };

  return {
    now,
    progress,
    skills,
    subjects,
    courses,
    byId,
    playable,
    certified,
    certCount,
    subjectOfSkill,
    subjectsAnswered: subjectsAnswered.size,
    subjectsCertified: subjectsCertified.size,
    formatsUsed: formatsUsed.size,
    masterCount,
    theoryPractice,
    knowledge,
    stats: progress.stats ?? {},
    activity: progress.activity ?? {},
    regularWeeks: regularWeeks(progress.activity ?? {}),
    weeklyDone: Object.keys(progress.weeklyMet ?? {}).length,
    challengesDone: (progress.challenges ?? []).filter((c) => c.done).length,
    subjectsWithQuestions: subjects.filter((sub) => sub.skills.some((s) => byId[s.id]?.qCount > 0)).length,
    unlockedCount: Object.keys(progress.achievements ?? {}).length,
    domainOpen: (id) => domainOpen(id, certCount, progress),
  };
}

/** Catalogue des succès. `value(ctx)` renvoie la valeur atteinte, comparée à `target`. */
export function buildCatalog(subjects, courses, bank) {
  const defs = [];
  // Ne compter que les compétences et matières jouables (qui ont au moins une question).
  const playableIds = new Set(bank.map((q) => q.skill));
  const playableSubjects = new Set(bank.map((q) => q.subjectId));
  const add = (id, group, label, desc, target, value, reward) =>
    defs.push({ id, group, label, desc, target, value, reward });

  // Réussite
  add('first_answer', 'reussite', 'Premier pas', 'Répondre à ta première question', 1, (c) => c.stats.answered ?? 0, 10);
  add('answers_50', 'reussite', 'Lancé', 'Répondre à 50 questions', 50, (c) => c.stats.answered ?? 0, 20);
  add('answers_200', 'reussite', 'Assidu', 'Répondre à 200 questions', 200, (c) => c.stats.answered ?? 0, 50);
  add('answers_500', 'reussite', 'Infatigable', 'Répondre à 500 questions', 500, (c) => c.stats.answered ?? 0, 100);
  add('first_cert', 'reussite', 'Première étoile', 'Certifier une première compétence', 1, (c) => c.certCount, 20);
  add('certs_5', 'reussite', 'Constellation', 'Certifier 5 compétences', 5, (c) => c.certCount, 50);
  add('certs_all', 'reussite', 'Tout certifier', 'Certifier toutes les compétences jouables',
    Math.max(1, playableIds.size), (c) => c.certCount, 200);
  add('run_5', 'reussite', 'Cinq d’affilée', 'Enchaîner 5 bonnes réponses', 5, (c) => c.stats.runBest ?? 0, 15);
  add('run_15', 'reussite', 'Série parfaite', 'Enchaîner 15 bonnes réponses', 15, (c) => c.stats.runBest ?? 0, 40);

  // Persévérance
  add('recover_1', 'perseverance', 'Rebondir', 'Réussir une question après l’avoir ratée', 1, (c) => c.stats.recoveries ?? 0, 10);
  add('recover_10', 'perseverance', 'Ne jamais lâcher', 'Rebondir 10 fois', 10, (c) => c.stats.recoveries ?? 0, 40);
  add('recover_30', 'perseverance', 'Résilience', 'Rebondir 30 fois', 30, (c) => c.stats.recoveries ?? 0, 100);
  add('comeback_1', 'perseverance', 'Retour en force', 'Revenir après une pause d’au moins une semaine', 1, (c) => c.stats.comebacks ?? 0, 15);
  add('days_5', 'perseverance', 'Cinq jours d’effort', 'Être actif 5 jours', 5, (c) => Object.keys(c.activity).length, 15);
  add('days_30', 'perseverance', 'Un mois d’effort', 'Être actif 30 jours', 30, (c) => Object.keys(c.activity).length, 60);

  // Polyvalence
  add('subjects_2', 'polyvalence', 'Curieux', 'Répondre dans 2 matières différentes', 2, (c) => c.subjectsAnswered, 15);
  add('subjects_all', 'polyvalence', 'Touche-à-tout', 'Répondre dans toutes les matières',
    Math.max(1, playableSubjects.size), (c) => c.subjectsAnswered, 60);
  add('formats_4', 'polyvalence', 'Varié', 'Utiliser 4 types d’exercices différents', 4, (c) => c.formatsUsed, 15);
  add('formats_all', 'polyvalence', 'Polyvalent', 'Utiliser tous les types d’exercices',
    Object.keys(FORMAT_LABELS).length, (c) => c.formatsUsed, 50);
  add('cross_3', 'polyvalence', 'Triple domaine', 'Certifier au moins une compétence dans 3 matières', 3, (c) => c.subjectsCertified, 30);

  // Maîtrise approfondie
  add('master_1', 'maitrise', 'Maître d’une compétence', 'Atteindre le niveau Maître dans une compétence', 1, (c) => c.masterCount, 30);
  add('master_3', 'maitrise', 'Maître confirmé', 'Atteindre le niveau Maître dans 3 compétences', 3, (c) => c.masterCount, 80);
  add('master_10', 'maitrise', 'Érudit', 'Atteindre le niveau Maître dans 10 compétences', 10, (c) => c.masterCount, 200);
  add('theory_practice_1', 'maitrise', 'Théorie et pratique', 'Théorie et pratique ≥ 80 % sur une compétence certifiée', 1, (c) => c.theoryPractice, 25);
  add('theory_practice_5', 'maitrise', 'Équilibre parfait', 'Théorie et pratique ≥ 80 % sur 5 compétences certifiées', 5, (c) => c.theoryPractice, 80);

  // Succès liés à des compétences précises (3 paliers par compétence)
  for (const sub of subjects) {
    for (const s of sub.skills.filter((k) => playableIds.has(k.id))) {
      add(`skill_open:${s.id}`, 'competence', `Premier contact : ${s.short ?? s.name}`,
        `Première bonne réponse en ${s.name}`, 1,
        (c) => (c.byId[s.id]?.events > 0 && c.byId[s.id].mastery > 0 ? 1 : 0), 5);
      add(`skill_cert:${s.id}`, 'competence', `Solide : ${s.short ?? s.name}`,
        `Certifier ${s.name}`, 1, (c) => (c.byId[s.id]?.certified ? 1 : 0), 20);
      add(`skill_expert:${s.id}`, 'competence', `Expertise : ${s.short ?? s.name}`,
        `Atteindre 95 % de maîtrise (niveau Maître) en ${s.name}`, 95,
        (c) => (c.byId[s.id]?.certified ? c.byId[s.id].mastery : 0), 40);
    }
  }

  // Succès liés aux projets réalisés : un cours est réalisé à 80 % de progression.
  for (const course of courses) {
    add(`project:${course.id}`, 'projet', `Projet réalisé : ${course.title}`,
      'Compléter le cours à 80 % (notions vues et exercices réussis)', 80,
      (c) => coursePct(course, c.progress), 30);
  }

  // Collections : toutes les compétences jouables d'une matière sont certifiées.
  for (const sub of subjects) {
    const ids = sub.skills.map((s) => s.id).filter((id) => playableIds.has(id));
    if (!ids.length) continue;
    add(`collection:${sub.id}`, 'collection', `Collection complète : ${sub.name}`,
      `Certifier toutes les compétences de ${sub.name}`, ids.length,
      (c) => ids.filter((id) => c.byId[id]?.certified).length, 60);
  }

  // Régularité : récompenses sans jamais pénaliser les pauses.
  add('regular_1', 'regularite', 'Première semaine régulière', 'Deux jours d’activité dans une même semaine', 1, (c) => c.regularWeeks, 10);
  add('regular_4', 'regularite', 'Régulier', 'Quatre semaines régulières, même espacées', 4, (c) => c.regularWeeks, 40);
  add('regular_12', 'regularite', 'Rituel', 'Douze semaines régulières', 12, (c) => c.regularWeeks, 150);

  // Objectif hebdomadaire facultatif
  add('weekly_1', 'objectif', 'Objectif de semaine atteint', 'Atteindre ton objectif hebdomadaire une fois', 1, (c) => c.weeklyDone, 15);
  add('weekly_4', 'objectif', 'Objectif tenu', 'Atteindre ton objectif hebdomadaire 4 fois', 4, (c) => c.weeklyDone, 60);

  // Défis personnels
  add('challenge_1', 'defi', 'Premier défi relevé', 'Terminer un défi personnel', 1, (c) => c.challengesDone, 25);
  add('challenge_5', 'defi', 'Défis en série', 'Terminer 5 défis personnels', 5, (c) => c.challengesDone, 100);

  // Domaines : un domaine verrouillé s'ouvre et devient un succès.
  for (const sub of subjects) {
    if (!(DOMAIN_REQUIREMENTS[sub.id] > 0)) continue;
    add(`domain:${sub.id}`, 'domaine', `Nouveau domaine : ${sub.name}`,
      `Ouvrir le domaine ${sub.name} en progressant`, 1, (c) => (c.domainOpen(sub.id) ? 1 : 0), 30);
  }

  return defs;
}

/** Défi : valeur courante, terminé, expiré. */
export function challengeStatus(c, ctx) {
  const startKey = dayKey(c.start);
  const value =
    c.kind === 'answers' ? answersSince(ctx.activity, startKey)
    : c.kind === 'days' ? activeDaysSince(ctx.activity, startKey)
    : ctx.certified.filter((s) => (ctx.byId[s.id]?.certified ?? 0) >= c.start).length;
  const done = Boolean(c.done);
  const expired = !done && ctx.now > c.start + c.days * DAY;
  return { value, done, expired, pct: Math.min(100, Math.round((value / c.target) * 100)) };
}

/**
 * Applique les règles : objectif hebdomadaire, défis, succès et domaines.
 * Renvoie { progress, unlocked }. Si rien ne change, renvoie la progression d'origine
 * (même référence), ce qui évite les boucles de mise à jour.
 * `unlocked` liste les nouveautés à annoncer ; la première migration est silencieuse.
 */
export function applyGamification(progress, subjects, bank, courses, now = Date.now()) {
  const p = structuredClone(progress);
  let changed = false;
  const unlocked = [];

  // 1. Objectif hebdomadaire : la semaine est marquée dès que l'objectif est atteint.
  if (p.weekly?.target) {
    const wk = weekKey(now);
    if (!p.weeklyMet?.[wk] && weekAnswers(p.activity, now) >= p.weekly.target) {
      p.weeklyMet = { ...(p.weeklyMet ?? {}), [wk]: true };
      changed = true;
      unlocked.push({ label: 'Objectif hebdomadaire atteint', group: 'objectif', reward: 0 });
    }
  }

  // 2. Défis personnels : terminés dès que la cible est atteinte pendant leur durée.
  const ctx0 = contextOf(p, subjects, bank, courses, now);
  p.challenges = (p.challenges ?? []).map((c) => {
    if (c.done) return c;
    const st = challengeStatus(c, ctx0);
    if (!st.expired && st.value >= c.target) {
      changed = true;
      p.xp += 25;
      unlocked.push({ label: `Défi relevé : ${c.title}`, group: 'defi', reward: 25 });
      return { ...c, done: now };
    }
    return c;
  });

  // 3. Succès : chacun n'est obtenu qu'une fois, puis reste acquis (historique).
  const ctx = contextOf(p, subjects, bank, courses, now);
  p.achievements = { ...(p.achievements ?? {}) };
  for (const def of buildCatalog(subjects, courses, bank)) {
    if (p.achievements[def.id]) continue;
    if (def.value(ctx) >= def.target) {
      p.achievements[def.id] = { t: now, label: def.label, group: def.group, reward: def.reward };
      p.xp += def.reward;
      changed = true;
      unlocked.push({ label: def.label, group: def.group, reward: def.reward });
    }
  }

  // 4. Première exécution sur une sauvegarde existante : rattrapage silencieux.
  const migrating = p.gamifVersion !== 1;
  if (migrating) {
    p.gamifVersion = 1;
    changed = true;
  }

  if (!changed) return { progress, unlocked: [] };
  return { progress: p, unlocked: migrating ? [] : unlocked };
}

/** État détaillé de chaque succès, pour l'affichage. */
export function achievementStatus(progress, subjects, bank, courses, now = Date.now()) {
  const ctx = contextOf(progress, subjects, bank, courses, now);
  return buildCatalog(subjects, courses, bank).map((def) => {
    const value = Math.min(def.target, def.value(ctx));
    const stamp = progress.achievements?.[def.id];
    return {
      ...def,
      value,
      pct: Math.round((value / def.target) * 100),
      unlocked: Boolean(stamp),
      t: stamp?.t ?? null,
    };
  });
}

/** Niveau de connaissances global : moyenne de maîtrise + part de compétences certifiées. */
export function knowledgeOf(progress, subjects, bank, courses, now = Date.now()) {
  const ctx = contextOf(progress, subjects, bank, courses, now);
  const k = ctx.knowledge;
  const span = k.next ? k.next.min - levelOf(k.avg, false).min : 0;
  const pct = k.next && span > 0 ? Math.min(100, Math.round(((k.avg - k.level.min) / span) * 100)) : 100;
  return { ...k, toNext: k.next ? Math.max(0, k.next.min - k.avg) : 0, pct, ctx };
}

/** Titres débloqués par les compétences certifiées. */
export function unlockedTitles(progress, subjects, bank, courses) {
  const ctx = contextOf(progress, subjects, bank, courses);
  return ctx.certified.map((s) => ({ id: s.id, title: titleOf(s), skill: s.short ?? s.name }));
}

/** Couleurs de profil accessibles. */
export function availablePalette(unlockedCount) {
  return PALETTE.map((c) => ({ ...c, available: unlockedCount >= c.need }));
}

/** Historique : succès, défis, et certifications, les plus récents d'abord. */
export function historyOf(progress, subjects) {
  const names = Object.fromEntries(flatSkills(subjects).map((s) => [s.id, s.name]));
  const entries = Object.values(progress.achievements ?? {}).map((a) => ({ t: a.t, label: a.label, group: a.group }));
  for (const [id, rec] of Object.entries(progress.skills ?? {})) {
    if (rec?.certified) entries.push({ t: rec.certified, label: `Compétence certifiée : ${names[id] ?? id}`, group: 'competence' });
  }
  return entries.sort((a, b) => b.t - a.t);
}

