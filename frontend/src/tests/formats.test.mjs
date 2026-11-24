import { FORMAT_IDS, FORMAT_LABELS, PRACTICE_FORMATS, availableFormats, buildExercise } from '../engine/formats.js';
import * as G from '../engine/grading.js';
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('FAIL:', msg); } };

// ---- Grading unitaires ----
ok(G.equivalentExpressions('3+2x', '2x+3'), 'expr commutative');
ok(G.equivalentExpressions('2x+3', '2*x+3'), 'implicit mult');
ok(!G.equivalentExpressions('2x+4', '2x+3'), 'expr differs');
ok(G.equivalentExpressions('x=4', '4=x') === true, 'equation swap sides');
ok(G.equivalentExpressions('(x+1)^2', 'x^2+2x+1'), 'binomial');
ok(!G.equivalentExpressions('', 'x'), 'empty expr');
ok(G.canonicalIntervals(']-∞;2] U [5;+∞[') === G.canonicalIntervals(']-∞;2]∪[5;+∞['), 'interval union with U');
ok(G.canonicalIntervals('(-∞;+∞)') === G.canonicalIntervals('ℝ'), 'R = (-inf;inf)');
ok(G.canonicalIntervals('[2;1]') === null, 'invalid interval rejected');
ok(G.canonicalIntervals('[1;3[') !== G.canonicalIntervals('[1;3]'), 'open vs closed differ');
ok(G.canonicalIntervals('[5;+∞[ ∪ ]-∞;2]') === G.canonicalIntervals(']-∞;2] ∪ [5;+∞['), 'union order irrelevant');
ok(JSON.stringify(G.parseTuple('(2 ; -3)')) === '[2,-3]', 'tuple semicolon');
ok(JSON.stringify(G.parseTuple('2,5 ; 1')) === '[2.5,1]', 'tuple decimal comma');
ok(G.parseTuple('a ; b') === null, 'tuple non numeric');
ok(G.parseValue('1/4') === 0.25, 'fraction');
ok(G.parseValue('0,5') === 0.5, 'decimal comma');
ok(G.parseValue('−3') === -3, 'unicode minus');
ok(G.solutionsEqual('S = {-3 ; 2}', [-3, 2]), 'solutions set');
ok(!G.solutionsEqual('2', [-3, 2]), 'missing solution');
ok(G.solutionsEqual('2 ou -3', [-3, 2]), 'solutions with ou');
ok(G.sameSet(G.parseEdges('A-B, B-C'), G.parseEdges('C-B, B-A')), 'graph undirected');
ok(!G.sameSet(G.parseEdges('A-B'), G.parseEdges('A-C')), 'graph differs');
ok(G.parseEdges('A?B') === null, 'graph bad token');
ok(G.evalBool('A & (!B | C)', { A: 1, B: 0, C: 0 }) === 1, 'bool eval 1');
ok(G.evalBool('A & (!B | C)', { A: 1, B: 1, C: 0 }) === 0, 'bool eval 0');
ok(G.evalBool('A XOR B', { A: 1, B: 1 }) === 0, 'xor word');
ok(G.evalBool('¬A ∨ B', { A: 0, B: 0 }) === 1, 'unicode ops');
const tt = G.truthTable('A & B');
ok(tt.rows.length === 4 && tt.rows.map(r => r.value).join('') === '0001', 'truth table AND');
ok(G.normalizeOutput(' 1  2 \n\n3 ') === '1 2\n3', 'output normalize');
ok(G.normalizeLoose('Je suis content.') === G.normalizeLoose('je suis content'), 'loose normalize');
ok(G.similarity('good morning', 'Good morning') === 1, 'similarity exact');
ok(G.similarity('thank you', 'thanks you') > 0.8, 'similarity close');
ok(G.numbersEqual(0.5, 0.5, { abs: 0.005 }), 'abs tol');
ok(G.numbersEqual(800000000, 1000000000, { mode: 'magnitude' }), 'magnitude same order');
ok(!G.numbersEqual(1e6, 1e9, { mode: 'magnitude' }), 'magnitude different order');
ok(G.numbersEqual(9.9, 10, { tolerance: { rel: 0.02 } }), 'rel tol');


// ---- Notions : frontières de mots, pluriel, options ----
const sem = { required: [['vitesse constante', 'vitesse uniforme'], ['racine']], labels: ['Vitesse', 'Racine'], forbidden: ['et'] };
ok(G.evaluateSemantic('Une vitesse constante, racine', sem).ok, 'notions : termes attendus');
ok(G.evaluateSemantic('des vitesses constantes et racines', sem).ok === false, 'notions : interdit « et » en mot entier');
ok(G.evaluateSemantic('Vitesse constante', sem).missing.join() === 'Racine', 'notions : manquante nommée');
ok(G.evaluateSemantic('etendu vitesse constante racine', { required: [['racine']], forbidden: ['et'] }).ok, 'notions : « étendu » ne contient pas « et »');
ok(G.evaluateSemantic('Oui racine', { required: [['racine']], optional: [['oui']] }).optional.found === 1, 'notions : optionnel signalé');
ok(G.evaluateSemantic('', sem).empty === true, 'notions : vide');
ok(G.keywordCoverage('La couche transport assure la communication entre processus', 'communication entre processus').found >= 1, 'couverture');

// ---- Diff mot à mot et ligne à ligne ----
const wd = G.wordDiff('le chat dort', 'le chat mange dort');
ok(wd.some((d) => d.k === 'add' && d.w === 'mange') && !wd.some((d) => d.k === 'del'), 'diff : mot en trop');
ok(G.wordDiff('a b c', 'a c').some((d) => d.k === 'del' && d.w === 'b'), 'diff : mot manquant');
ok(G.lineDiff('1\n2', '1\n2').every((d) => d.k === 'same'), 'diff lignes identiques');

// ---- Grandeurs et unités ----
ok(G.quantityCheck('12,5 cm', 12.5, { unit: 'cm', tolerance: { abs: 0.01 } }).ok, 'unité : même unité');
ok(G.quantityCheck('125 mm', 12.5, { unit: 'cm', tolerance: { abs: 0.01 } }).ok, 'unité : conversion mm → cm');
ok(G.quantityCheck('12,5', 12.5, { unit: 'cm', requireUnit: true, tolerance: { abs: 0.01 } }).reason === 'missing-unit', 'unité : manquante');
ok(G.quantityCheck('12,5 kg', 12.5, { unit: 'cm', tolerance: { abs: 0.01 } }).reason === 'wrong-unit', 'unité : incompatible');
ok(G.quantityCheck('3 × 10^8 m', 3e8, { unit: 'm', tolerance: { rel: 0.01 } }).ok, 'unité : notation scientifique');
ok(G.quantityCheck('2,70 g/cm³', 2.7, { unit: 'g/cm3', sigfigs: 3 }).ok, 'unité : masse volumique et chiffres significatifs');
ok(G.quantityCheck('2,7 g/cm3', 2.7, { unit: 'g/cm3', sigfigs: 3 }).reason === 'sigfigs', 'sigfigs : 2 chiffres refusés si 3 attendus');
ok(G.countSigFigs('0,0052') === 2 && G.countSigFigs('1200') === 2 && G.countSigFigs('1200,0') === 5, 'chiffres significatifs');

// ---- Contre-exemples, équations, logique ----
ok(G.checkCounterexample('-3', 'x^2 > 4', 'x > 2').ok, 'contre-exemple : -3 valide');
ok(G.checkCounterexample('3', 'x^2 > 4', 'x > 2').reason === 'conclusion', 'contre-exemple : 3 ne convient pas');
ok(G.checkCounterexample('1', 'x^2 > 4', 'x > 2').reason === 'hypothesis', 'contre-exemple : hypothèse fausse');
ok(G.residuals('x^2 + x - 6 = 0', [2, -3]).every((r) => Math.abs(r.residual) < 1e-9), 'équation : solutions vérifiées');
ok(G.logicEquivalent('A & !B', '!(!A | B)'), 'logique : De Morgan');
ok(!G.logicEquivalent('A | B', 'A & B'), 'logique : non équivalentes');
ok(G.logicDiffRows('A | B', 'A & B').length >= 1, 'logique : lignes en désaccord');

// ---- Étapes, forme, code, complexité, diagnostic ----
ok(G.formSignature('32+8x+8x') === G.formSignature('8x+8x+32'), 'forme : ordre des termes');
ok(G.formSignature('5x+30+5x') !== G.formSignature('10x+30'), 'forme : une réduction n’est pas la forme écrite');
ok(G.stepMatches('3+4 = 7', '3+4'), 'étape numérique : égalité');
ok(!G.stepMatches('5x+30+5x', '10x+30'), 'étape : équivalente mais pas la forme attendue');
ok(G.checkBrackets('f(a[1], {b: 2})') && !G.checkBrackets('f(a'), 'parenthèses équilibrées');
ok(G.normalizeComplexity('O(n²)') === G.normalizeComplexity('O(n^2)') && G.normalizeComplexity('Θ(n)') === G.normalizeComplexity('theta(n)'), 'complexité : notations');
ok(G.parseValue('30 %') === 0.3, 'pourcentage');
const d = G.diagnoseExpression('2x+3', '2x+4');
ok(d && d.want !== d.got, 'diagnostic : expression fausse localisée');
ok(G.diagnoseExpression('2x+3', '3+2x') === null, 'diagnostic : expressions égales');

// ---- Registre ----
const here = new URL('.', import.meta.url).pathname;
const ex = JSON.parse(fs.readFileSync(here + '../docs/exemples_formats.json', 'utf8'));
const covered = new Set(ex.map((q) => q.formats[0]));
for (const id of FORMAT_IDS) ok(covered.has(id), `format sans exemple : ${id}`);
ok(FORMAT_IDS.length === Object.keys(FORMAT_LABELS).length, 'labels cover all formats');
console.log(`Formats enregistrés : ${FORMAT_IDS.length} (dont pratique : ${PRACTICE_FORMATS.length})`);

// Bonne et mauvaise réponses par format (simulation de l'interface)
const good = {
  multi_choice: (e) => e.answers,
  single_choice: (e) => e.correct, true_false: (e) => e.correct, flashcard: null, fill_blank: (e) => e.blanks.map(a => a[0]),
  ordering: (e) => e.steps.map((s) => e.shuffled.indexOf(s)), matching: (e) => Object.fromEntries(e.pairs),
  numeric: (e) => (e.unit ? `${e.value} ${e.unit}` : e.value), short_answer: () => 'Paris', long_answer: null, math_expression: (e) => (e.steps?.length ? e.steps.map((st) => st.answer).join('\n') : e.answer),
  code_answer: null, proof: null, guided_proof: (e) => e.blanks.map(a => a[0]), proof_completion: (e) => e.blanks.map(a => a[0]),
  proof_reordering: (e) => e.steps.map((s) => e.shuffled.indexOf(s)), proof_error_detection: (e) => e.correct,
  justify_answer: null, numeric_answer: (e) => (e.sigfigs ? '2,70 g/cm3' : `${e.value} ${e.unit}`), equation_solver: () => '2 ; -3',
  logic_circuit: (e) => (e.parts ? e.parts.map(p => p.answer) : e.reveal), induction_proof: null, expression_simplification: () => '6',
  matrix_operation: () => ({ '0,0': '1', '0,1': '2', '1,0': '3', '1,1': '4' }),
  confusion_matrix: null, probability_tree: (e) => e.parts.map(p => p.answer), sequence_completion: (e) => e.parts.map(p => p.answer),
  multi_step_calculation: (e) => e.parts.map(p => p.answer), function_analysis: (e) => e.parts.map(p => p.answer),
  coordinate_answer: () => '(-2 ; 3)', interval_answer: () => ']-∞;2] ∪ [5;+∞[', vector_operation: () => '(3 ; -1)',
  counterexample: null, case_analysis: (e) => e.parts.map(p => p.answer), estimate_answer: () => '1000000000',
  recursive_trace: (e) => e.parts.map(p => p.answer), code_completion: (e) => e.blanks.map(a => a[0]),
  debugging: null, code_output: () => '0\n1\n2', execution_trace: null, refactoring: null,
  complexity_analysis: (e) => e.parts.map(p => p.answer), translation: () => 'good morning!', speaking: null, pronunciation: null,
  listening: () => 'Bonjour', reading_comprehension: (e) => e.correct, conjugation: (e) => e.parts.map(p => p.answer),
  dialogue_completion: (e) => e.blanks.map(a => a[0]), dictation: () => 'je suis content', vocabulary_matching: (e) => Object.fromEntries(e.pairs),
  contextual_vocabulary: (e) => e.correct, word_order: (e) => e.steps.map((s) => e.shuffled.indexOf(s)),
  conversation_roleplay: (e) => e.turns.map((t) => t.choices[0].value), source_analysis: null, historical_comparison: null,
  scientific_calculation: (e) => `${e.value} ${e.unit}`, data_analysis: null, graph_builder: () => 'C-A, B-A, C-B',
  geometry_canvas: (e) => e.parts.map(p => ({ 'A : abscisse': 0, 'A : ordonnée': 0, 'B : abscisse': 4, 'B : ordonnée': 0, 'C : abscisse': 0, 'C : ordonnée': 3 })[p.label]),
  block_programming: (e) => e.steps.map((s) => e.shuffled.indexOf(s)), odd_one_out: (e) => e.correct, table_completion: (e) => ({ '1,1': '1,20' }),
};

const bad = {
  multi_choice: (e) => [e.options.find((o) => !e.answers.includes(o))],
  single_choice: (e) => e.choices.find((c) => c.value !== e.correct).value, true_false: (e) => !e.correct,
  numeric: (e) => e.value + 5, short_answer: () => 'Lyon', math_expression: () => '2x+4', equation_solver: () => '2',
  ordering: (e) => { const idx = e.steps.map((s) => e.shuffled.indexOf(s)); [idx[0], idx[1]] = [idx[1], idx[0]]; return idx; }, matching: (e) => Object.fromEntries(e.pairs.map(([l]) => [l, 'x'])),
  interval_answer: () => '[2;5]', coordinate_answer: () => '(1 ; 1)', estimate_answer: () => '10', graph_builder: () => 'A-B',
  expression_simplification: () => '2x', translation: () => 'hello', code_output: () => '0\n1', odd_one_out: (e) => e.choices.find(c => c.value !== e.correct).value,
  fill_blank: (e) => e.blanks.map(() => 'zzz'), logic_circuit: (e) => (e.parts ? e.parts.map(p => p.answer === '1' ? '0' : '1') : '1'),
  geometry_canvas: () => ({}), table_completion: () => ({ '1,1': '9' }), matrix_operation: () => ({ '0,0': '99', '0,1': '99', '1,0': '99', '1,1': '99' }),
  case_analysis: (e) => e.parts.map(() => 'zzz'), speaking: () => 'Bonjour', pronunciation: () => 'Bonjour', listening: () => 'Paris',
  dictation: () => 'Je suis triste.', word_order: (e) => { const idx = e.steps.map((s) => e.shuffled.indexOf(s)); [idx[0], idx[1]] = [idx[1], idx[0]]; return idx; },
};

const views = new Map();
for (const q of ex) {
  const id = q.formats[0];
  const formats = availableFormats(q);
  ok(formats.includes(id), `${id} disponible pour son exemple`);
  if (!formats.includes(id)) continue;
  let e;
  try { e = buildExercise(q, id); } catch (err) { ok(false, `${id} build: ${err.message}`); continue; }
  views.set(id, e.view);
  ok(e.format === id && typeof e.view === 'string', `${id} exercise shape`);
  ok(typeof e.reveal === 'string', `${id} reveal string`);
  const g = good[id];
  if (g && e.judge) {
    const input = g(e);
    const res = e.judge(input);
    ok(res === true, `${id} bonne réponse acceptée (entrée=${JSON.stringify(input)})`);
  }
  if (bad[id] && e.judge) {
    const res = e.judge(bad[id](e));
    ok(res === false, `${id} mauvaise réponse refusée`);
  }
}
console.log(`Vues utilisées : ${[...new Set(views.values())].sort().join(', ')}`);

// Chaque format doit être constructible depuis un exemple, avec sa vue annoncée.
const counts = {};
for (const v of views.values()) counts[v] = (counts[v] ?? 0) + 1;
console.log('Répartition par vue :', JSON.stringify(counts));

// Exemple sans données : le format ne doit pas être proposé.
ok(availableFormats({ formats: ['fill_blank', 'matching', 'logic_circuit', 'unknown_fmt'] }).length === 0, 'formats sans données filtrés');

console.log(`\n${pass} vérifications réussies, ${fail} échecs.`);
process.exitCode = fail ? 1 : 0;
