// Tests de la progression : niveau logarithmique, auto-évaluation plafonnée, pourcentages de cours, migration.
import { levelInfo, xpForLevel, levelFromXp } from '../engine/levels.js';
import { valueOfAnswer, SELF_VALUE } from '../engine/mastery.js';
import { isAcquired, coursePct, countAcquired } from '../engine/courseProgress.js';
import { migrateIntegrity } from '../engine/progress.js';
import { dayStreaks, periodStart } from '../engine/streaks.js';
import { DAY, dayKey } from '../engine/activity.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };
const ev = (v, extra = {}) => ({ t: Date.now(), v, f: 'single_choice', ...extra });

// Niveau logarithmique
ok(xpForLevel(1) === 0 && xpForLevel(2) === 100, 'niveau : seuils de base');
ok(xpForLevel(3) - xpForLevel(2) > xpForLevel(2) - xpForLevel(1), 'niveau : chaque niveau coûte davantage');
ok(levelFromXp(xpForLevel(7)) === 7 && levelFromXp(xpForLevel(7) - 1) === 6, 'niveau : inverse exact aux seuils');
const li = levelInfo(500);
ok(li.level === 4 && li.pct === 46 && li.toNext === 119, 'niveau : pourcentage et XP restants (500 XP)');

// Auto-évaluation plafonnée
ok(valueOfAnswer(true, 5, false) === SELF_VALUE.compris && valueOfAnswer(true, 3, false) === SELF_VALUE.presque, 'auto-évaluation : valeurs plafonnées');
ok(valueOfAnswer(false, 5, false) === 0, 'auto-évaluation : « Raté » vaut 0');
ok(valueOfAnswer(true, 5, true) === 1, 'réponse vérifiée : valeur pleine');

// Pourcentage de cours : spam et fausses réussites
const playable = new Set(['q1', 'q2', 'q3', 'q4']);
const spamWrong = { qlog: { q1: Array.from({ length: 20 }, () => ev(0)) } };
ok(!isAcquired('q1', spamWrong), 'spam de mauvaises réponses : aucune question acquise');
const spamSelf = { qlog: { q1: Array.from({ length: 20 }, () => ev(0.6, { s: 1 })) } };
ok(!isAcquired('q1', spamSelf), 'spam d’auto-évaluations « Compris » : aucune question acquise');
const real = { qlog: { q1: [ev(1), ev(1)] } };
ok(isAcquired('q1', real), 'deux réussites vérifiées : question acquise');
ok(countAcquired(['q1', 'q2', 'q3', 'q4'], real, playable).done === 1, 'comptage : 1 question sur 4');
const course = { id: 'c', sections: [{ id: 's', questionIds: ['q1', 'q2', 'q3', 'q4'] }] };
ok(coursePct(course, spamWrong, playable) === 0 && coursePct(course, spamSelf, playable) === 0, 'cours : spam = 0 %');
ok(coursePct(course, real, playable) === 25, 'cours : 25 % pour une question sur quatre');
const noise = { qlog: { q9: [ev(1), ev(1)] }, course: { c: { 's::Hello': true } } };
ok(coursePct(course, noise, playable) === 0, 'cours : notions lues et brouillons ne comptent pas');

// Migration : les anciennes auto-évaluations sont plafonnées, les notions lues effacées
const old = { integrity: 1, course: { c: { 's::x': true } }, qlog: { a: [{ t: 1, v: 1, f: 'flashcard' }, { t: 2, v: 1, f: 'numeric' }] } };
const m = migrateIntegrity(old);
ok(m.course.c === undefined && m.integrity === 2, 'migration : notions lues effacées');
ok(m.qlog.a[0].v === 0.6 && m.qlog.a[0].s === 1 && m.qlog.a[1].v === 1, 'migration : auto-évaluation plafonnée, réponse vérifiée intacte');
ok(migrateIntegrity(m) === m, 'migration : idempotente');

// Séries
const now = Date.now();
const act = { [dayKey(now)]: 2, [dayKey(now - DAY)]: 1, [dayKey(now - 3 * DAY)]: 4 };
const st = dayStreaks(act, now);
ok(st.current === 2 && st.best === 2, 'séries : série en cours et record');
ok(periodStart('all', now) === 0 && periodStart('week', now) <= now, 'périodes : bornes');

console.log(`${pass} vérifications réussies, ${fail} échecs.`);
process.exitCode = fail ? 1 : 0;
