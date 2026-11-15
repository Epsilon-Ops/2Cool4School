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
  // Couleurs de base
  { color: '#f85211', name: 'Orange', need: 0 },
  { color: '#1cb0f6', name: 'Bleu', need: 0 },
  { color: '#ce82ff', name: 'Violet', need: 5 },
  { color: '#58cc02', name: 'Vert', need: 10 },
  { color: '#ffc800', name: 'Jaune', need: 20 },
  { color: '#ff86d0', name: 'Rose', need: 30 },
  { color: '#ff3b3b', name: 'Rouge', need: 35 },
  { color: '#ffffff', name: 'Blanc', need: 40 },
  { color: '#252525', name: 'Noir', need: 45 },
  { color: '#795548', name: 'Marron', need: 50 },
  { color: '#00bfa5', name: 'Turquoise', need: 55 },
  { color: '#607dff', name: 'Indigo', need: 60 },

  // Couleurs vives
  { color: '#ff1744', name: 'Rouge Flash', need: 70 },
  { color: '#ff9100', name: 'Orange Néon', need: 80 },
  { color: '#eeff00', name: 'Jaune Néon', need: 90 },
  { color: '#00ff66', name: 'Vert Néon', need: 100 },
  { color: '#00e5ff', name: 'Cyan Flash', need: 110 },
  { color: '#2979ff', name: 'Bleu Électrique', need: 120 },
  { color: '#d500f9', name: 'Violet Néon', need: 130 },
  { color: '#ff00a8', name: 'Rose Néon', need: 140 },
  { color: '#ff4081', name: 'Rose Bonbon', need: 150 },
  { color: '#ff6d00', name: 'Mandarine', need: 160 },

  // Couleurs premium
  { color: '#00ffff', name: 'Laser', need: 200 },
  { color: '#7fff00', name: 'Lime', need: 220 },
  { color: '#ff00ff', name: 'Magenta', need: 240 },
  { color: '#9400ff', name: 'Ultra Violet', need: 260 },
  { color: '#00aaff', name: 'Plasma', need: 280 },
  { color: '#ff1493', name: 'Pink Power', need: 300 },
  { color: '#39ff14', name: 'Toxic', need: 320 },
  { color: '#ff3131', name: 'Laser Rouge', need: 350 },

  // Couleurs très rares
  { color: '#ffd700', name: 'Or', need: 400 },
  { color: '#c0c0c0', name: 'Argent', need: 450 },
  { color: '#b9f2ff', name: 'Diamant', need: 500 },
  { color: '#e5b3ff', name: 'Améthyste', need: 550 },
  { color: '#ff4500', name: 'Supernova', need: 600 },
  { color: '#00ffcc', name: 'Cyber', need: 650 },
  { color: '#ff00ff', name: 'Hyper Flash', need: 700 },
  { color: '#ccff00', name: 'Radioactif', need: 750 },

  // Couleurs légendaires
  { color: '#ff0080', name: 'Légendaire Rose', need: 850 },
  { color: '#00f5ff', name: 'Légendaire Cyan', need: 900 },
  { color: '#a100ff', name: 'Légendaire Violet', need: 1000 },
  { color: '#ffea00', name: 'Légendaire Soleil', need: 1100 },
  { color: '#ff0000', name: 'Légendaire Sang', need: 1200 },
  { color: '#00ff00', name: 'Légendaire Matrix', need: 1300 },
  { color: '#ffffff', name: 'Légendaire Pureté', need: 1500 },
  { color: '#ff6ec7', name: 'Légendaire Étoile', need: 1750 },
  { color: '#7df9ff', name: 'Légendaire Énergie', need: 2000 },
  { color: '#bf00ff', name: 'Légendaire Chaos', need: 2500 },
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
    questionIds: new Set(bank.map((q) => q.id)),
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
  add('answers_10', 'reussite', 'Échauffement', 'Répondre à 10 questions', 10, (c) => c.stats.answered ?? 0, 12);
  add('answers_25', 'reussite', 'Mise en route', 'Répondre à 25 questions', 25, (c) => c.stats.answered ?? 0, 15);
  add('answers_50', 'reussite', 'Lancé', 'Répondre à 50 questions', 50, (c) => c.stats.answered ?? 0, 20);
  add('answers_100', 'reussite', 'Rythme de croisière', 'Répondre à 100 questions', 100, (c) => c.stats.answered ?? 0, 35);
  add('answers_200', 'reussite', 'Assidu', 'Répondre à 200 questions', 200, (c) => c.stats.answered ?? 0, 50);
  add('answers_300', 'reussite', 'Déterminé', 'Répondre à 300 questions', 300, (c) => c.stats.answered ?? 0, 70);
  add('answers_500', 'reussite', 'Infatigable', 'Répondre à 500 questions', 500, (c) => c.stats.answered ?? 0, 100);
  add('answers_750', 'reussite', ' infatigable de l’esprit', 'Répondre à 750 questions', 750, (c) => c.stats.answered ?? 0, 150);
  add('answers_1000', 'reussite', 'Vétéran', 'Répondre à 1 000 questions', 1000, (c) => c.stats.answered ?? 0, 200);
  add('answers_1500', 'reussite', 'Maître des chiffres', 'Répondre à 1 500 questions', 1500, (c) => c.stats.answered ?? 0, 280);
  add('answers_2000', 'reussite', 'Encyclopédie vivante', 'Répondre à 2 000 questions', 2000, (c) => c.stats.answered ?? 0, 350);
  add('answers_2500', 'reussite', 'Légende', 'Répondre à 2 500 questions', 2500, (c) => c.stats.answered ?? 0, 450);
  add('answers_5000', 'reussite', 'Titan du savoir', 'Répondre à 5 000 questions', 5000, (c) => c.stats.answered ?? 0, 800);
  add('answers_10000', 'reussite', 'Omniscient', 'Répondre à 10 000 questions', 10000, (c) => c.stats.answered ?? 0, 1500);

  add('first_cert', 'reussite', 'Première étoile', 'Certifier une première compétence', 1, (c) => c.certCount, 20);
  add('certs_2', 'reussite', 'Duo gagnant', 'Certifier 2 compétences', 2, (c) => c.certCount, 30);
  add('certs_3', 'reussite', 'Trio de choc', 'Certifier 3 compétences', 3, (c) => c.certCount, 40);
  add('certs_5', 'reussite', 'Constellation', 'Certifier 5 compétences', 5, (c) => c.certCount, 50);
  add('certs_8', 'reussite', 'Huit branches', 'Certifier 8 compétences', 8, (c) => c.certCount, 75);
  add('certs_10', 'reussite', 'Voie lactée', 'Certifier 10 compétences', 10, (c) => c.certCount, 90);
  add('certs_15', 'reussite', 'Amas globulaire', 'Certifier 15 compétences', 15, (c) => c.certCount, 120);
  add('certs_20', 'reussite', 'Galaxie', 'Certifier 20 compétences', 20, (c) => c.certCount, 150);
  add('certs_30', 'reussite', 'Superamas', 'Certifier 30 compétences', 30, (c) => c.certCount, 220);
  add('certs_50', 'reussite', 'Univers infini', 'Certifier 50 compétences', 50, (c) => c.certCount, 300);
  add('certs_all', 'reussite', 'Tout certifier', 'Certifier toutes les compétences jouables',
    Math.max(1, playableIds.size), (c) => c.certCount, 200);

  add('run_2', 'reussite', 'Duo correct', 'Enchaîner 2 bonnes réponses', 2, (c) => c.stats.runBest ?? 0, 8);
  add('run_3', 'reussite', 'Le triplé', 'Enchaîner 3 bonnes réponses', 3, (c) => c.stats.runBest ?? 0, 10);
  add('run_5', 'reussite', 'Cinq d’affilée', 'Enchaîner 5 bonnes réponses', 5, (c) => c.stats.runBest ?? 0, 15);
  add('run_8', 'reussite', 'Huit de suite', 'Enchaîner 8 bonnes réponses', 8, (c) => c.stats.runBest ?? 0, 22);
  add('run_10', 'reussite', 'Sur sa lancée', 'Enchaîner 10 bonnes réponses', 10, (c) => c.stats.runBest ?? 0, 30);
  add('run_12', 'reussite', 'Série de bronze', 'Enchaîner 12 bonnes réponses', 12, (c) => c.stats.runBest ?? 0, 35);
  add('run_15', 'reussite', 'Série parfaite', 'Enchaîner 15 bonnes réponses', 15, (c) => c.stats.runBest ?? 0, 40);
  add('run_20', 'reussite', 'Série d’argent', 'Enchaîner 20 bonnes réponses', 20, (c) => c.stats.runBest ?? 0, 55);
  add('run_25', 'reussite', 'Inarrêtable', 'Enchaîner 25 bonnes réponses', 25, (c) => c.stats.runBest ?? 0, 70);
  add('run_30', 'reussite', 'Série d’or', 'Enchaîner 30 bonnes réponses', 30, (c) => c.stats.runBest ?? 0, 90);
  add('run_40', 'reussite', 'Virtuose', 'Enchaîner 40 bonnes réponses', 40, (c) => c.stats.runBest ?? 0, 120);
  add('run_50', 'reussite', 'Machine à réponses', 'Enchaîner 50 bonnes réponses', 50, (c) => c.stats.runBest ?? 0, 150);
  add('run_75', 'reussite', 'Génie intouchable', 'Enchaîner 75 bonnes réponses', 75, (c) => c.stats.runBest ?? 0, 250);
  add('run_100', 'reussite', 'Divin', 'Enchaîner 100 bonnes réponses sans erreur', 100, (c) => c.stats.runBest ?? 0, 350);

  // Persévérance
  add('recover_1', 'perseverance', 'Rebondir', 'Réussir une question après l’avoir ratée', 1, (c) => c.stats.recoveries ?? 0, 10);
  add('recover_3', 'perseverance', 'Accrocheur', 'Rebondir 3 fois', 3, (c) => c.stats.recoveries ?? 0, 18);
  add('recover_5', 'perseverance', 'Obstiné', 'Rebondir 5 fois', 5, (c) => c.stats.recoveries ?? 0, 25);
  add('recover_8', 'perseverance', 'Tenace', 'Rebondir 8 fois', 8, (c) => c.stats.recoveries ?? 0, 32);
  add('recover_10', 'perseverance', 'Ne jamais lâcher', 'Rebondir 10 fois', 10, (c) => c.stats.recoveries ?? 0, 40);
  add('recover_15', 'perseverance', 'Volontaire', 'Rebondir 15 fois', 15, (c) => c.stats.recoveries ?? 0, 55);
  add('recover_20', 'perseverance', 'Ténacité', 'Rebondir 20 fois', 20, (c) => c.stats.recoveries ?? 0, 75);
  add('recover_25', 'perseverance', 'Inébranlable', 'Rebondir 25 fois', 25, (c) => c.stats.recoveries ?? 0, 90);
  add('recover_30', 'perseverance', 'Résilience', 'Rebondir 30 fois', 30, (c) => c.stats.recoveries ?? 0, 100);
  add('recover_40', 'perseverance', 'Force de caractère', 'Rebondir 40 fois', 40, (c) => c.stats.recoveries ?? 0, 140);
  add('recover_50', 'perseverance', 'Infaillible après l’échec', 'Rebondir 50 fois', 50, (c) => c.stats.recoveries ?? 0, 180);
  add('recover_75', 'perseverance', 'Phoenix', 'Rebondir 75 fois', 75, (c) => c.stats.recoveries ?? 0, 250);
  add('recover_100', 'perseverance', 'Maître de la résilience', 'Rebondir 100 fois', 100, (c) => c.stats.recoveries ?? 0, 350);

  add('comeback_1', 'perseverance', 'Retour en force', 'Revenir après une pause d’au moins une semaine', 1, (c) => c.stats.comebacks ?? 0, 15);
  add('comeback_2', 'perseverance', 'Rechute salutaire', 'Revenir après 2 pauses d’une semaine', 2, (c) => c.stats.comebacks ?? 0, 30);
  add('comeback_3', 'perseverance', 'Fidèle au retour', 'Revenir après 3 pauses d’une semaine', 3, (c) => c.stats.comebacks ?? 0, 45);
  add('comeback_4', 'perseverance', 'Insatiable', 'Revenir après 4 pauses d’une semaine', 4, (c) => c.stats.comebacks ?? 0, 60);
  add('comeback_5', 'perseverance', 'Le retour du Jedi', 'Revenir après 5 pauses d’une semaine', 5, (c) => c.stats.comebacks ?? 0, 80);
  add('comeback_10', 'perseverance', 'L’éternel revenant', 'Revenir après 10 pauses d’une semaine', 10, (c) => c.stats.comebacks ?? 0, 150);

  add('days_1', 'perseverance', 'Premier jour', 'Être actif 1 jour', 1, (c) => Object.keys(c.activity).length, 5);
  add('days_3', 'perseverance', 'Trois jours', 'Être actif 3 jours', 3, (c) => Object.keys(c.activity).length, 10);
  add('days_5', 'perseverance', 'Cinq jours d’effort', 'Être actif 5 jours', 5, (c) => Object.keys(c.activity).length, 15);
  add('days_7', 'perseverance', 'Première semaine', 'Être actif 7 jours', 7, (c) => Object.keys(c.activity).length, 20);
  add('days_10', 'perseverance', 'Dix jours d’engagement', 'Être actif 10 jours', 10, (c) => Object.keys(c.activity).length, 30);
  add('days_15', 'perseverance', 'Quinze jours', 'Être actif 15 jours', 15, (c) => Object.keys(c.activity).length, 45);
  add('days_20', 'perseverance', 'Cap des vingt jours', 'Être actif 20 jours', 20, (c) => Object.keys(c.activity).length, 50);
  add('days_30', 'perseverance', 'Un mois d’effort', 'Être actif 30 jours', 30, (c) => Object.keys(c.activity).length, 60);
  add('days_45', 'perseverance', 'Un mois et demi', 'Être actif 45 jours', 45, (c) => Object.keys(c.activity).length, 90);
  add('days_60', 'perseverance', 'Deux mois d’effort', 'Être actif 60 jours', 60, (c) => Object.keys(c.activity).length, 120);
  add('days_90', 'perseverance', 'Saison complète', 'Être actif 90 jours', 90, (c) => Object.keys(c.activity).length, 200);
  add('days_100', 'perseverance', 'Cent jours d’activité', 'Être actif 100 jours', 100, (c) => Object.keys(c.activity).length, 250);
  add('days_150', 'perseverance', 'Cent cinquante jours', 'Être actif 150 jours', 150, (c) => Object.keys(c.activity).length, 380);
  add('days_200', 'perseverance', 'Cap des deux cents', 'Être actif 200 jours', 200, (c) => Object.keys(c.activity).length, 500);
  add('days_365', 'perseverance', 'Une année complète', 'Être actif 365 jours', 365, (c) => Object.keys(c.activity).length, 1000);

// Polyvalence
  add('subjects_1', 'polyvalence', 'Initié', 'Répondre dans 1 matière', 1, (c) => c.subjectsAnswered, 10);
  add('subjects_2', 'polyvalence', 'Curieux', 'Répondre dans 2 matières différentes', 2, (c) => c.subjectsAnswered, 15);
  add('subjects_3', 'polyvalence', 'Explorateur', 'Répondre dans 3 matières différentes', 3, (c) => c.subjectsAnswered, 25);
  add('subjects_4', 'polyvalence', 'Voyageur des savoirs', 'Répondre dans 4 matières différentes', 4, (c) => c.subjectsAnswered, 35);
  add('subjects_5', 'polyvalence', 'Voyageur', 'Répondre dans 5 matières différentes', 5, (c) => c.subjectsAnswered, 45);
  add('subjects_8', 'polyvalence', 'Électron libre', 'Répondre dans 8 matières différentes', 8, (c) => c.subjectsAnswered, 65);
  add('subjects_10', 'polyvalence', 'Encyclopédique', 'Répondre dans 10 matières différentes', 10, (c) => c.subjectsAnswered, 90);
  add('subjects_all', 'polyvalence', 'Touche-à-tout', 'Répondre dans toutes les matières',
    Math.max(1, playableSubjects.size), (c) => c.subjectsAnswered, 120);

  add('formats_1', 'polyvalence', 'Premier format', 'Utiliser 1 type d’exercice', 1, (c) => c.formatsUsed, 5);
  add('formats_2', 'polyvalence', 'Adapté', 'Utiliser 2 types d’exercices différents', 2, (c) => c.formatsUsed, 10);
  add('formats_3', 'polyvalence', 'Polyvalent débutant', 'Utiliser 3 types d’exercices différents', 3, (c) => c.formatsUsed, 15);
  add('formats_4', 'polyvalence', 'Varié', 'Utiliser 4 types d’exercices différents', 4, (c) => c.formatsUsed, 20);
  add('formats_5', 'polyvalence', 'Multitâche', 'Utiliser 5 types d’exercices différents', 5, (c) => c.formatsUsed, 30);
  add('formats_all', 'polyvalence', 'Polyvalent', 'Utiliser tous les types d’exercices',
    Object.keys(FORMAT_LABELS).length, (c) => c.formatsUsed, 50);

  add('cross_1', 'polyvalence', 'Première discipline', 'Certifier au moins une compétence dans 1 matière', 1, (c) => c.subjectsCertified, 15);
  add('cross_2', 'polyvalence', 'Double casquette', 'Certifier au moins une compétence dans 2 matières', 2, (c) => c.subjectsCertified, 20);
  add('cross_3', 'polyvalence', 'Triple domaine', 'Certifier au moins une compétence dans 3 matières', 3, (c) => c.subjectsCertified, 30);
  add('cross_4', 'polyvalence', 'Quatre horizons', 'Certifier au moins une compétence dans 4 matières', 4, (c) => c.subjectsCertified, 45);
  add('cross_5', 'polyvalence', 'Cinq dimensions', 'Certifier au moins une compétence dans 5 matières', 5, (c) => c.subjectsCertified, 60);
  add('cross_8', 'polyvalence', 'Maître éclectique', 'Certifier au moins une compétence dans 8 matières', 8, (c) => c.subjectsCertified, 90);
  add('cross_all', 'polyvalence', 'Omniprésent', 'Certifier au moins une compétence dans toutes les matières',
    Math.max(1, playableSubjects.size), (c) => c.subjectsCertified, 150);

// Maîtrise approfondie
  add('master_1', 'maitrise', 'Maître d’une compétence', 'Atteindre le niveau Maître dans une compétence', 1, (c) => c.masterCount, 30);
  add('master_2', 'maitrise', 'Double maîtrise', 'Atteindre le niveau Maître dans 2 compétences', 2, (c) => c.masterCount, 55);
  add('master_3', 'maitrise', 'Maître confirmé', 'Atteindre le niveau Maître dans 3 compétences', 3, (c) => c.masterCount, 80);
  add('master_5', 'maitrise', 'Expert', 'Atteindre le niveau Maître dans 5 compétences', 5, (c) => c.masterCount, 130);
  add('master_8', 'maitrise', 'Grand expert', 'Atteindre le niveau Maître dans 8 compétences', 8, (c) => c.masterCount, 170);
  add('master_10', 'maitrise', 'Érudit', 'Atteindre le niveau Maître dans 10 compétences', 10, (c) => c.masterCount, 200);
  add('master_15', 'maitrise', 'Grand érudit', 'Atteindre le niveau Maître dans 15 compétences', 15, (c) => c.masterCount, 300);
  add('master_20', 'maitrise', 'Grand Sage', 'Atteindre le niveau Maître dans 20 compétences', 20, (c) => c.masterCount, 400);
  add('master_30', 'maitrise', 'Maître absolu', 'Atteindre le niveau Maître dans 30 compétences', 30, (c) => c.masterCount, 650);
  add('master_50', 'maitrise', 'Philosophe suprême', 'Atteindre le niveau Maître dans 50 compétences', 50, (c) => c.masterCount, 1000);

  add('theory_practice_1', 'maitrise', 'Théorie et pratique', 'Théorie et pratique ≥ 80 % sur une compétence certifiée', 1, (c) => c.theoryPractice, 25);
  add('theory_practice_2', 'maitrise', 'Double équilibre', 'Théorie et pratique ≥ 80 % sur 2 compétences certifiées', 2, (c) => c.theoryPractice, 38);
  add('theory_practice_3', 'maitrise', 'Double compétence', 'Théorie et pratique ≥ 80 % sur 3 compétences certifiées', 3, (c) => c.theoryPractice, 50);
  add('theory_practice_5', 'maitrise', 'Équilibre parfait', 'Théorie et pratique ≥ 80 % sur 5 compétences certifiées', 5, (c) => c.theoryPractice, 80);
  add('theory_practice_8', 'maitrise', 'Sagesse mesurée', 'Théorie et pratique ≥ 80 % sur 8 compétences certifiées', 8, (c) => c.theoryPractice, 120);
  add('theory_practice_10', 'maitrise', 'Harmonie absolue', 'Théorie et pratique ≥ 80 % sur 10 compétences certifiées', 10, (c) => c.theoryPractice, 160);
  add('theory_practice_15', 'maitrise', 'Maîtrise symétrique', 'Théorie et pratique ≥ 80 % sur 15 compétences certifiées', 15, (c) => c.theoryPractice, 240);
  add('theory_practice_20', 'maitrise', 'Perfection totale', 'Théorie et pratique ≥ 80 % sur 20 compétences certifiées', 20, (c) => c.theoryPractice, 320);

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
      (c) => coursePct(course, c.progress, c.questionIds), 30);
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
  add('regular_2', 'regularite', 'Double rythme', 'Deux semaines régulières, même espacées', 2, (c) => c.regularWeeks, 20);
  add('regular_3', 'regularite', 'Cadence établie', 'Trois semaines régulières', 3, (c) => c.regularWeeks, 30);
  add('regular_4', 'regularite', 'Régulier', 'Quatre semaines régulières, même espacées', 4, (c) => c.regularWeeks, 40);
  add('regular_6', 'regularite', 'Rythme de croisière', 'Six semaines régulières', 6, (c) => c.regularWeeks, 65);
  add('regular_8', 'regularite', 'Habitude ancrée', 'Huit semaines régulières', 8, (c) => c.regularWeeks, 90);
  add('regular_10', 'regularite', 'Discipline souple', 'Dix semaines régulières', 10, (c) => c.regularWeeks, 120);
  add('regular_12', 'regularite', 'Rituel', 'Douze semaines régulières', 12, (c) => c.regularWeeks, 150);
  add('regular_16', 'regularite', 'Saison rythmée', 'Seize semaines régulières', 16, (c) => c.regularWeeks, 200);
  add('regular_20', 'regularite', 'Constance libre', 'Vingt semaines régulières', 20, (c) => c.regularWeeks, 260);
  add('regular_26', 'regularite', 'Semestre harmonieux', 'Vingt-six semaines régulières', 26, (c) => c.regularWeeks, 350);
  add('regular_35', 'regularite', 'Équilibre durable', 'Trente-cinq semaines régulières', 35, (c) => c.regularWeeks, 480);
  add('regular_52', 'regularite', 'Cycle accompli', 'Cinquante-deux semaines régulières', 52, (c) => c.regularWeeks, 700);

  // Objectif hebdomadaire facultatif
  add('weekly_1', 'objectif', 'Objectif de semaine atteint', 'Atteindre ton objectif hebdomadaire une fois', 1, (c) => c.weeklyDone, 15);
  add('weekly_2', 'objectif', 'Cap hebdomadaire', 'Atteindre ton objectif hebdomadaire 2 fois', 2, (c) => c.weeklyDone, 30);
  add('weekly_3', 'objectif', 'Régularité hebdo', 'Atteindre ton objectif hebdomadaire 3 fois', 3, (c) => c.weeklyDone, 45);
  add('weekly_4', 'objectif', 'Objectif tenu', 'Atteindre ton objectif hebdomadaire 4 fois', 4, (c) => c.weeklyDone, 60);
  add('weekly_6', 'objectif', 'Cap franchi', 'Atteindre ton objectif hebdomadaire 6 fois', 6, (c) => c.weeklyDone, 90);
  add('weekly_8', 'objectif', 'Rythme hebdomadaire', 'Atteindre ton objectif hebdomadaire 8 fois', 8, (c) => c.weeklyDone, 120);
  add('weekly_10', 'objectif', 'Dix semaines ciblées', 'Atteindre ton objectif hebdomadaire 10 fois', 10, (c) => c.weeklyDone, 160);
  add('weekly_15', 'objectif', 'Cap des quinze', 'Atteindre ton objectif hebdomadaire 15 fois', 15, (c) => c.weeklyDone, 240);
  add('weekly_20', 'objectif', 'Maître du temps', 'Atteindre ton objectif hebdomadaire 20 fois', 20, (c) => c.weeklyDone, 320);
  add('weekly_30', 'objectif', 'Année rythmée', 'Atteindre ton objectif hebdomadaire 30 fois', 30, (c) => c.weeklyDone, 500);

  // Défis personnels
  add('challenge_1', 'defi', 'Premier défi relevé', 'Terminer un défi personnel', 1, (c) => c.challengesDone, 25);
  add('challenge_2', 'defi', 'Double défi', 'Terminer 2 défis personnels', 2, (c) => c.challengesDone, 50);
  add('challenge_3', 'defi', 'Triple épreuve', 'Terminer 3 défis personnels', 3, (c) => c.challengesDone, 75);
  add('challenge_5', 'defi', 'Défis en série', 'Terminer 5 défis personnels', 5, (c) => c.challengesDone, 100);
  add('challenge_8', 'defi', 'Aventurier', 'Terminer 8 défis personnels', 8, (c) => c.challengesDone, 160);
  add('challenge_10', 'defi', 'Collectionneur de défis', 'Terminer 10 défis personnels', 10, (c) => c.challengesDone, 200);
  add('challenge_15', 'defi', 'Héros des épreuves', 'Terminer 15 défis personnels', 15, (c) => c.challengesDone, 310);
  add('challenge_20', 'defi', 'Maître des défis', 'Terminer 20 défis personnels', 20, (c) => c.challengesDone, 420);
  add('challenge_30', 'defi', 'Légende des épreuves', 'Terminer 30 défis personnels', 30, (c) => c.challengesDone, 650);

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

