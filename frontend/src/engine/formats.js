/**
 * Registre des formats d'exercices.
 *
 * Chaque format est décrit par :
 * - label  : nom affiché ;
 * - kind   : 'theory' (reconnaître, choisir, ordonner, relier…) ou 'practice'
 *            (calculer, saisir, rédiger, coder…). Sert à la maîtrise et à la certification ;
 * - view   : le composant qui affiche l'exercice (voir components/Activity.jsx) ;
 * - needs  : les données que la question doit fournir pour que le format soit proposé ;
 * - build  : construit l'exercice concret à partir de la question.
 *
 * Correction : `check(valeur)` renvoie { ok, items }. Les items sont les retours affichés à l'élève
 * (voir `Feedback` dans Activity.jsx) :
 *   { t: 'ok' | 'bad' | 'warn' | 'info', text }
 *   { t: 'list', title, items: [texte], tone }
 *   { t: 'diff', title, items: [{ k: 'same' | 'del' | 'add', w }] }
 *
 * Ajouter un format = une entrée ici (+ une vue si aucune vue existante ne convient).
 * Le détail des données attendues par format est dans README.md.
 */
import { evaluate } from 'mathjs';
import { shuffle } from './random.js';
import { instantiate, distractorsFor, formatNumber, fillTemplate } from './template.js';
import {
  parseValue,
  numbersEqual,
  decimalsOf,
  checkAnswer,
  matchesAny,
  matchesSemantic,
  evaluateSemantic,
  keywordCoverage,
  hasTerm,
  tokenize,
  normalize,
  normalizeLoose,
  normalizeOutput,
  equivalentExpressions,
  solutionSet,
  solutionsEqual,
  parseEdges,
  sameSet,
  truthTable,
  cellMatches,
  parseTuple,
  tuplesEqual,
  canonicalIntervals,
  similarity,
  wordDiff,
  lineDiff,
  quantityCheck,
  parseQuantity,
  normalizeComplexity,
  stepMatches,
  formSignature,
  checkBrackets,
  checkCounterexample,
  residuals,
  logicEquivalent,
  logicDiffRows,
  diagnoseExpression,
  preparse,
} from './grading.js';

// ---------- Utilitaires de validation des données ----------

const str = (x) => typeof x === 'string' && x.trim() !== '';
const nonEmptyArr = (x, n = 1) => Array.isArray(x) && x.length >= n;
const isNumberLike = (x) => x !== undefined && x !== null && parseValue(String(x)) !== null;
const safe = (fn) => {
  try {
    return fn();
  } catch {
    return null;
  }
};

/** Vrai si la sélection contient exactement les bonnes valeurs (sans doublon). */
function sameValues(sel, answers) {
  const want = new Set(answers);
  return sel.length === want.size && sel.every((v) => want.has(v));
}

/** Réponses acceptées pour chaque trou : une chaîne, ou une liste de variantes. */
function blanksOf(q, text = q.cloze) {
  if (!str(text)) return null;
  const n = (text.match(/\{\{blank\}\}/g) ?? []).length;
  const raw = q.answers ?? (q.answer !== undefined ? [q.answer] : []);
  if (n === 0 || raw.length !== n) return null;
  return raw.map((a) => (Array.isArray(a) ? a.map(String) : [String(a)]));
}

/** Parties d'un exercice à plusieurs réponses : [{ label, answer, kind, accepts, tolerance }]. */
function partsOf(src, kind) {
  if (!nonEmptyArr(src) || src.some((p) => p?.answer === undefined)) return null;
  return src.map((p) => {
    const k = p.kind ?? kind;
    return {
      label: p.label ?? '',
      answer: String(p.answer),
      kind: k,
      accepts: p.accepts ?? [],
      tolerance: p.tolerance ?? (k === 'number' ? { abs: 0.005 } : undefined),
    };
  });
}

/** Grille de tableau : cases « ? » à compléter, réponses attendues dans `answer`. */
function gridBlanks(q) {
  const t = q.table;
  const a = q.answer;
  if (!Array.isArray(t) || !Array.isArray(a) || t.length !== a.length) return null;
  const blanks = [];
  for (let i = 0; i < t.length; i++) {
    if (!Array.isArray(t[i]) || !Array.isArray(a[i]) || t[i].length !== a[i].length) return null;
    t[i].forEach((c, j) => {
      if (c === '?') blanks.push([i, j]);
    });
  }
  return blanks.length ? blanks : null;
}

const fmtNum = (x) => String(Number(x.toFixed(6))).replace('.', ',');
const fmtShort = (x) => String(Number(Number(x).toFixed(3))).replace('.', ',');

/** Mélange qui ne laisse pas l'ordre initial, quand c'est possible. */
function scramble(items) {
  let s = shuffle(items);
  for (let k = 0; k < 5 && s.every((x, i) => x === items[i]); k++) s = shuffle(items);
  return s;
}

const anyEquiv = (value, list) => list.some((a) => equivalentExpressions(value, a));

// ---------- Retours (items affichés à l'élève) ----------

/** Écrit une formule comme on la lit : x^2 → x², 2*x → 2·x. */
const pretty = (s) =>
  String(s ?? '')
    .replace(/\^2/g, '²')
    .replace(/\^3/g, '³')
    .replace(/\*/g, '·');

const itemOk = (text) => ({ t: 'ok', text });
const itemBad = (text) => ({ t: 'bad', text });
const itemWarn = (text) => ({ t: 'warn', text });
const itemInfo = (text) => ({ t: 'info', text });
const itemList = (title, items, tone = 'warn') => ({ t: 'list', title, items, tone });
const itemDiff = (title, items) => ({ t: 'diff', title, items });

/** Normalise le résultat d'une correction : booléen ou { ok, items }. */
function asCheck(fn) {
  return (v) => {
    const r = fn(v);
    if (typeof r === 'boolean') return { ok: r, items: [] };
    return { ok: Boolean(r.ok), items: r.items ?? [] };
  };
}

/** Ajoute à un exercice sa correction `check` et son `judge` (booléen) dérivé. */
function withCheck(ex, fn) {
  const check = asCheck(fn);
  return { ...ex, check, judge: (v) => check(v).ok };
}

/** Correction par notions (grille semantique) avec retour sur les notions manquantes. */
function semanticCheck(text, evaluation) {
  const r = evaluateSemantic(text, evaluation);
  if (r.empty) return { ok: false, items: [itemBad('Réponse vide.')] };
  const items = r.found.map((f) => (f.ok ? itemOk(f.label) : itemBad(`Notion manquante : ${f.label}`)));
  if (r.forbidden.length) items.push(itemBad(`Termes à éviter : ${r.forbidden.join(', ')}.`));
  const extra = r.missing.filter((m) => !r.found.some((f) => !f.ok && f.label === m));
  extra.forEach((m) => items.push(itemWarn(`À ajouter : ${m}.`)));
  if (r.optional.total) {
    items.push(itemInfo(`Précisions utiles repérées : ${r.optional.found}/${r.optional.total} (facultatif).`));
  }
  return { ok: r.ok, items };
}

/** Correction d'une réponse libre sans grille : couverture des notions du corrigé. */
function coverageCheck(model, typed, { minRatio = 0.5, minWords = 0 } = {}) {
  const tokens = tokenize(typed);
  if (!tokens.length) return { ok: false, items: [itemBad('Réponse vide.')] };
  const items = [];
  const c = keywordCoverage(model, typed);
  let ok = true;
  if (c.total) {
    const enough = c.found / c.total >= minRatio;
    ok = ok && enough;
    items.push(
      enough
        ? itemOk(`Notions clés repérées : ${c.found}/${c.total}.`)
        : itemBad(`Notions clés à reprendre : ${c.missing.slice(0, 6).join(', ')}.`),
    );
  }
  if (minWords && tokens.length < minWords) {
    ok = false;
    items.push(itemWarn('Réponse trop courte pour être développée.'));
  }
  return { ok, items };
}

/** Réponse courte ou développée : exact, puis grille de notions, puis couverture du corrigé. */
function openTextCheck(q, v, { minWords = 0 } = {}) {
  if (matchesAny(v, [q.answer, ...(q.accepts ?? [])])) return { ok: true, items: [itemOk('Réponse exacte.')] };
  if (q.evaluation) return semanticCheck(v, q.evaluation);
  return coverageCheck(q.answer ?? '', v, { minWords: q.minWords ?? minWords });
}

/** Points de la grille d'auto-évaluation : une entrée par notion, testable sur le brouillon. */
function groupItems(evaluation, sec) {
  const items = [];
  (evaluation.required ?? []).forEach((g, i) => {
    const label = evaluation.labels?.[i] ?? (Array.isArray(g) ? g[0] : g);
    items.push({ label, sec, test: (t) => evaluateSemantic(t, { required: [g] }).ok });
  });
  (evaluation.forbidden ?? []).forEach((w) => {
    items.push({ label: `Ne pas utiliser « ${w} »`, sec, test: (t) => !hasTerm(tokenize(t), w) });
  });
  if (evaluation.atLeast) {
    const { count, groups, labels } = evaluation.atLeast;
    const names = labels ?? groups.map((g) => (Array.isArray(g) ? g[0] : g));
    items.push({
      label: `Au moins ${count} parmi : ${names.join(', ')}`,
      sec,
      test: (t) => groups.filter((g) => evaluateSemantic(t, { required: [g] }).ok).length >= count,
    });
  }
  return items;
}

// ---------- Calcul (format « Expression mathématique » avec étapes) ----------

/** Remplace les variables par leurs valeurs, entre parenthèses si elles sont négatives. */
function resolveMathExpression(expression, variables) {
  return Object.entries(variables).reduce(
    (result, [key, value]) =>
      result.replace(new RegExp(`\\b${key}\\b`, 'g'), value < 0 ? `(${value})` : String(value)),
    String(expression),
  );
}

/** Entier aléatoire dans [min, max]. */
function randomInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Dictionnaire de variables entières tirées dans une plage. */
function generateMathVariables(range, names = ['x', 'y']) {
  const lo = Math.ceil(Math.min(...range));
  const hi = Math.floor(Math.max(...range));
  return Object.fromEntries(names.map((name) => [name, randomInteger(lo, hi)]));
}

function calculateMathExpression(expression, variables = {}) {
  return evaluate(expression, variables);
}

/** Valeur d'une expression, ou undefined si elle ne se calcule pas. */
function safeCalc(expression, variables) {
  const r = safe(() => calculateMathExpression(expression, variables));
  return typeof r === 'number' && Number.isFinite(r) ? r : undefined;
}

/** Tire des variables pour lesquelles le calcul (et ses étapes) se déroule, avec un résultat entier si demandé. */
function pickVariables(q, calc) {
  if (!q.range) return q.variables ?? {};
  const names = q.names ?? ['x', 'y'];
  for (let k = 0; k < 50; k++) {
    const vars = generateMathVariables(q.range, names);
    const value = safeCalc(calc.expression, vars);
    const integerOk = !q.integerResult || (value !== undefined && Number.isInteger(value));
    const stepsOk = (calc.steps ?? []).every((s) => safeCalc(s.answer, vars) !== undefined);
    if (value !== undefined && integerOk && stepsOk) return vars;
  }
  return generateMathVariables(q.range, names);
}

/**
 * Vérifie que les étapes obligatoires apparaissent dans l'ordre.
 * Les étapes facultatives peuvent être ignorées, les lignes supplémentaires sont tolérées.
 * Renvoie { ok, found: [{ label, ok }] }.
 */
function matchOrderedSteps(value, steps) {
  const required = steps.filter((s) => s.required !== false);
  const candidates = String(value ?? '')
    .split(/[\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  let cursor = 0;
  const found = [];
  for (const s of required) {
    const expected = String(s.answer);
    let hit = false;
    while (cursor < candidates.length) {
      if (stepMatches(candidates[cursor], expected)) {
        hit = true;
        cursor++;
        break;
      }
      cursor++;
    }
    found.push({ label: s.label ?? expected, ok: hit });
  }
  return { ok: required.length > 0 && found.every((f) => f.ok), found };
}

/** Compatibilité : vrai si toutes les étapes obligatoires sont présentes dans l'ordre. */
function orderedExpressionsMatch(value, steps) {
  return matchOrderedSteps(value, steps).ok;
}

/** Tire les variables d'un gabarit : { a: { range: [min, max], integer: true } }. */
function genFromSpec(spec) {
  return Object.fromEntries(
    Object.entries(spec ?? {}).map(([name, v]) => {
      const [lo, hi] = v.range ?? [0, 1];
      const a = Math.ceil(Math.min(lo, hi));
      const b = Math.floor(Math.max(lo, hi));
      return [name, randomInteger(a, b)];
    }),
  );
}

/** Nombre écrit pour une expression : entier, ou décimal court. Négatif entre parenthèses. */
function fmtExpr(v) {
  const txt = Number.isInteger(v) ? String(v) : String(Number(v.toFixed(4)));
  return v < 0 ? `(${txt})` : txt;
}

/**
 * Remplace chaque {expression} par sa valeur : {a} → 3, {a+c} → 10, {a*b} → 12.
 * Une expression qui ne se calcule pas est laissée telle quelle.
 */
function renderTemplate(text, values) {
  return String(text ?? '').replace(/\{([^{}]+)\}/g, (m, expr) => {
    const v = safeCalc(expr, values);
    return v === undefined ? m : fmtExpr(v);
  });
}

/**
 * Exercice de calcul à gabarit (ex. développer et réduire) :
 * les valeurs sont tirées à chaque affichage, la réponse et les étapes sont calculées à partir d'elles.
 */
function buildTemplateMath(q, base) {
  const values = genFromSpec(q.variables);
  const expected = renderTemplate(q.expected, values);
  const prompt = renderTemplate(q.prompt, values);
  const useSteps = q.requireSteps === true && nonEmptyArr(q.steps);
  const steps = useSteps
    ? q.steps.map((st, i) => {
        const text = typeof st === 'string' ? st : (st.answer ?? st.text ?? '');
        return { label: `Étape ${i + 1}`, answer: renderTemplate(text, values), required: true };
      })
    : [];
  const reveal = useSteps
    ? [...steps.map((s) => s.answer), expected].join('\n')
    : expected;
  return textExercise(
    { ...base, prompt, answer: expected },
    (v) => {
      if (useSteps) {
        const r = matchOrderedSteps(v, steps);
        const items = r.found.map((f, i) => (f.ok ? itemOk(`Étape ${i + 1} juste.`) : itemBad(`Étape ${i + 1} : fausse ou manquante.`)));
        if (r.ok) return { ok: true, items: [itemOk('Toutes les étapes sont justes.')] };
        return { ok: false, items: [...items, ...expressionHint(v, expected)] };
      }
      if (equivalentExpressions(v, expected)) return { ok: true, items: [itemOk('Résultat juste.')] };
      return { ok: false, items: [itemBad('Résultat faux.'), ...expressionHint(v, expected)] };
    },
    {
      mono: true,
      multiline: useSteps,
      values,
      expression: expected,
      steps,
      placeholder: q.placeholder ?? (useSteps ? 'Écris les étapes de ton calcul...' : 'Écris ton résultat...'),
      hint: q.hint ?? (useSteps ? 'Écris les étapes dans l’ordre, une par ligne.' : 'Écris l’expression réduite (2x ou 2*x).'),
      reveal,
    },
  );
}

/** Explication d'une expression fausse : valeur de chaque côté pour un jeu de variables. */
function expressionHint(v, expected) {
  const d = diagnoseExpression(v, expected);
  if (d?.error === 'syntax') return [itemWarn('Je n’arrive pas à lire ton expression : vérifie les parenthèses et les opérateurs (2x ou 2*x, x^2).')];
  if (d?.error === 'equation') return [itemWarn('Une équation attend un signe « = » des deux côtés.')];
  if (!d) return [];
  const scope = Object.entries(d.scope).map(([k, x]) => `${k} = ${fmtShort(x)}`).join(', ');
  return [itemInfo(`Pour ${scope}, ton expression vaut ${fmtShort(d.got)} et la bonne vaut ${fmtShort(d.want)}.`)];
}

/** Calcul guidé : l'élève écrit chaque étape, on compare étape par étape. */
function buildCalculation(q, base) {
  const calc = q.calculation;
  const variables = pickVariables(q, calc);
  const expression = resolveMathExpression(calc.expression, variables);
  const steps = (calc.steps ?? []).map((step, i) => {
    const answer = resolveMathExpression(step.answer, variables);
    const value = safeCalc(step.answer, variables);
    return { ...step, label: step.label ?? `Étape ${i + 1}`, answer, value };
  });
  const reveal = steps.length
    ? steps
        .map((s) => `${s.label} : ${s.answer}${s.value !== undefined ? ` = ${fmtShort(s.value)}` : ''}`)
        .join('\n')
    : expression;

  return textExercise(
    { ...base, answer: expression },
    (v) => {
      if (steps.length) {
        const r = matchOrderedSteps(v, steps);
        const items = r.found.map((f) => (f.ok ? itemOk(f.label) : itemBad(`${f.label} : fausse ou manquante`)));
        if (r.ok) return { ok: true, items: [itemOk('Toutes les étapes sont justes.')] };
        return { ok: false, items };
      }
      const ok = equivalentExpressions(v, expression);
      return { ok, items: ok ? [itemOk('Résultat juste.')] : [itemBad('Résultat faux.')] };
    },
    {
      mono: true,
      multiline: true,
      variables,
      expression,
      steps,
      placeholder: q.placeholder ?? 'Écris les étapes de ton calcul...',
      hint: q.hint ?? 'Écris les étapes de ton calcul dans l’ordre, une par ligne.',
      reveal,
    },
  );
}

// ---------- Constructeurs communs ----------

function explainsOf(q, scope) {
  const f = (t) => (scope ? fillTemplate(t, scope) : t ?? '');
  return {
    simple: f(q.explanations?.simple ?? q.explanation),
    normal: f(q.explanation),
    deep: f(q.explanations?.deep ?? q.explanation),
  };
}

function choiceFrom(base, answer, wrongs, extra = {}) {
  const choices = shuffle([answer, ...wrongs]).map((v) => ({ value: v, label: v }));
  return { ...base, choices, correct: answer, ...extra };
}

/** Explication d'une valeur numérique fausse (ordre de grandeur, unité, chiffres significatifs). */
function numericItems(r, { unit, sigfigs, value, decimals, mode }) {
  if (r.ok) return [itemOk('Réponse correcte.')];
  switch (r.reason) {
    case 'format':
      return [itemBad('Je n’ai pas reconnu une valeur numérique.')];
    case 'missing-unit':
      return [itemBad(`N’oublie pas l’unité (${unit}).`)];
    case 'wrong-unit':
      return [itemBad(`Unité incompatible : il faut une grandeur en ${unit}.`)];
    case 'sigfigs':
      return [itemBad(`Attendu : ${sigfigs} chiffre${sigfigs > 1 ? 's' : ''} significatif${sigfigs > 1 ? 's' : ''}.`)];
    default:
      if (mode === 'magnitude' && value) {
        return [itemBad(`Ordre de grandeur différent : la valeur est proche de 10^${Math.floor(Math.log10(Math.abs(value)))}.`)];
      }
      return [itemBad(`Valeur fausse${unit ? ` (attendu en ${unit})` : ''}.`)];
  }
}

function numericExercise(q, base, inst, { mode, defaultTolerance } = {}) {
  const value = inst ? inst.value : q.range ? (q.range[0] + q.range[1]) / 2 : parseValue(q.answer);
  const decimals = inst ? inst.decimals : (q.decimals ?? decimalsOf(q.answer));
  const tolerance = q.tolerance ?? defaultTolerance;
  const unit = q.unit ?? null;
  const lo = q.range ? Math.min(...q.range) : null;
  const hi = q.range ? Math.max(...q.range) : null;
  const shown = q.range
    ? `entre ${formatNumber(lo, decimals)} et ${formatNumber(hi, decimals)}`
    : formatNumber(value, decimals);
  const check = (raw) => {
    const text = typeof raw === 'number' ? String(raw) : raw;
    if (q.range) {
      const parsed = parseQuantity(text);
      const v = parsed ? parsed.value : null;
      const ok = v !== null && v >= lo && v <= hi;
      return { ok, items: ok ? [itemOk('Dans l’intervalle attendu.')] : [itemBad(`La valeur doit être ${shown}.`)] };
    }
    const r = quantityCheck(text, value, {
      unit,
      tolerance,
      decimals,
      mode,
      sigfigs: q.sigfigs,
      requireUnit: Boolean(unit) && q.requireUnit !== false,
    });
    const items = numericItems(r, { unit, sigfigs: q.sigfigs, value, decimals, mode });
    if (!r.ok && q.sigfigs && r.reason === 'value') items.push(itemInfo(`Réponse attendue : ${shown}.`));
    return { ok: r.ok, items };
  };
  return withCheck(
    {
      ...base,
      view: 'numeric',
      value,
      decimals,
      unit,
      sigfigs: q.sigfigs,
      formula: q.formula,
      reveal: `${shown}${unit ? ` ${unit}` : ''}`,
    },
    check,
  );
}

function textExercise(base, fn, extra = {}) {
  return withCheck({ ...base, view: 'text', ...extra }, fn);
}

/**
 * Rédaction ou carte à retourner : l'élève écrit, affiche le corrigé, puis s'auto-évalue
 * à l'aide d'une grille. Les notions de la grille sont cochées automatiquement sur le brouillon.
 */
function selfExercise(q, base, extra = {}) {
  const sections = nonEmptyArr(q.sections)
    ? q.sections.map((s) => ({
        label: s.label ?? '',
        model: String(s.answer ?? ''),
        evaluation: s.evaluation,
        criteria: s.criteria ?? [],
      }))
    : null;
  const checklist = [];
  if (sections) {
    sections.forEach((s, k) => {
      if (s.evaluation) checklist.push(...groupItems(s.evaluation, k));
      s.criteria.forEach((c) => checklist.push({ label: c, sec: k }));
    });
  } else {
    if (q.evaluation) checklist.push(...groupItems(q.evaluation, null));
    (q.criteria ?? []).forEach((c) => checklist.push({ label: c, sec: null }));
  }
  const reveal = sections ? sections.map((s) => `${s.label} : ${s.model}`).join(' · ') : base.answer;
  return {
    ...base,
    view: 'self',
    write: true,
    criteria: q.criteria ?? [],
    code: q.code,
    data: q.data,
    passage: q.source ?? q.passage,
    sections: sections ? sections.map(({ label, model }) => ({ label, model })) : null,
    checklist: [...checklist, ...(extra.checklistExtra ?? [])],
    diffItems: extra.diffFrom !== undefined ? lineDiff(extra.diffFrom, q.answer ?? '').filter((d) => d.k !== 'same') : undefined,
    reveal,
    ...extra,
  };
}

function clozeExercise(text, blanks, base, extra = {}) {
  const check = (vals) => {
    const wrong = blanks.map((acc, i) => (matchesAny(vals[i] ?? '', acc) ? null : i)).filter((i) => i !== null);
    const right = blanks.length - wrong.length;
    const items = wrong.map((i) => itemBad(`Trou ${i + 1} : attendu « ${blanks[i][0]} »`));
    if (!wrong.length) return { ok: true, items: [itemOk(`Tous les trous sont justes (${blanks.length}/${blanks.length}).`)] };
    return { ok: false, items: [itemInfo(`${right}/${blanks.length} trous justes.`), ...items] };
  };
  return withCheck(
    {
      ...base,
      view: 'cloze',
      cloze: text,
      blanks,
      reveal: blanks.map((a) => a[0]).join(' · '),
      ...extra,
    },
    check,
  );
}

/** Plusieurs réponses courtes. Chaque partie est vérifiée selon sa nature (nombre, texte, intervalle…). */
function partsExercise(base, parts, extra = {}) {
  const checkPart = (i, raw) => checkAnswer(parts[i].kind, raw, parts[i].answer, parts[i]);
  const check = (vals) => {
    const results = parts.map((_, i) => checkPart(i, vals[i] ?? ''));
    const right = results.filter(Boolean).length;
    const items = [itemInfo(`${right}/${parts.length} réponses justes.`)];
    parts.forEach((p, i) => {
      if (results[i]) return;
      const name = p.label || `Réponse ${i + 1}`;
      items.push(itemBad(`${name} : attendu « ${p.answer} »`));
    });
    return { ok: right === parts.length, items: right === parts.length ? [itemOk('Toutes les réponses sont justes.')] : items };
  };
  return withCheck(
    {
      ...base,
      view: 'parts',
      parts,
      checkPart,
      reveal: parts.map((p) => (p.label ? `${p.label} : ${p.answer}` : p.answer)).join(' · '),
      ...extra,
    },
    check,
  );
}

function orderingExercise(base, steps) {
  const shuffled = scramble(steps);
  const check = (chosen) => {
    const placed = chosen.map((ix) => shuffled[ix]);
    const good = steps.map((s, k) => placed[k] === s);
    const right = good.filter(Boolean).length;
    if (chosen.length === steps.length && right === steps.length) {
      return { ok: true, items: [itemOk('Ordre correct.')] };
    }
    const items = [itemInfo(`${right}/${steps.length} étapes à la bonne place.`)];
    good.forEach((g, k) => {
      if (!g && placed[k] !== undefined) items.push(itemBad(`Position ${k + 1} : « ${placed[k]} » ne convient pas.`));
    });
    return { ok: false, items };
  };
  return withCheck({ ...base, view: 'ordering', steps, shuffled, reveal: steps.join(' → ') }, check);
}

function matchingExercise(q, base) {
  const expected = Object.fromEntries(q.pairs);
  const rights = shuffle(q.pairs.map((p) => p[1]));
  const check = (links) => {
    const wrong = q.pairs.filter(([l]) => links[l] !== expected[l]);
    if (!wrong.length) return { ok: true, items: [itemOk('Toutes les associations sont justes.')] };
    const items = [itemInfo(`${q.pairs.length - wrong.length}/${q.pairs.length} associations justes.`)];
    wrong.forEach(([l]) => {
      items.push(itemBad(`« ${l} » : attendu « ${expected[l]} »${links[l] ? ` (tu as mis « ${links[l]} »)` : ''}.`));
    });
    return { ok: false, items };
  };
  return withCheck(
    {
      ...base,
      view: 'matching',
      pairs: q.pairs,
      rights,
      reveal: q.pairs.map(([l, r]) => `${l} = ${r}`).join(' · '),
    },
    check,
  );
}

/** Indicateurs d'une matrice de confusion 2 × 2 (positif = seconde ligne et colonne). */
function confusionMetrics(expected) {
  const n = (x) => parseValue(x) ?? 0;
  const TP = n(expected[1][1]);
  const FN = n(expected[1][2]);
  const FP = n(expected[2][1]);
  const TN = n(expected[2][2]);
  const total = TP + FN + FP + TN;
  const pct = (x) => `${Math.round(x * 1000) / 10} %`;
  return [
    itemInfo(`Exactitude (accuracy) : ${pct(total ? (TP + TN) / total : 0)}.`),
    itemInfo(`Précision : ${pct(TP + FP ? TP / (TP + FP) : 0)}. Rappel : ${pct(TP + FN ? TP / (TP + FN) : 0)}.`),
  ];
}

function tableExercise(q, base, extra = {}) {
  const blanks = gridBlanks(q);
  const expected = q.answer.map((r) => r.map(String));
  const grid = q.table.map((r) => r.map(String));
  const cellLabel = (i, j) => {
    const row = grid[i][0] !== '?' ? grid[i][0] : '';
    const col = grid[0][j] !== '?' ? grid[0][j] : '';
    return [row, col].filter(Boolean).join(' / ') || `ligne ${i + 1}, colonne ${j + 1}`;
  };
  const check = (vals) => {
    const wrong = blanks.filter(([i, j]) => !cellMatches(vals[`${i},${j}`] ?? '', expected[i][j]));
    const items = [];
    if (wrong.length) {
      items.push(itemInfo(`${blanks.length - wrong.length}/${blanks.length} cases justes.`));
      wrong.forEach(([i, j]) => items.push(itemBad(`${cellLabel(i, j)} : attendu ${expected[i][j]}`)));
    } else {
      items.push(itemOk('Toutes les cases sont justes.'));
    }
    if (extra.metrics) items.push(...extra.metrics(expected));
    return { ok: wrong.length === 0, items };
  };
  const reveal = blanks.map(([i, j]) => expected[i][j]).join(' · ');
  const checkCell = (i, j, raw) => cellMatches(raw, expected[i][j]);
  return withCheck(
    {
      ...base,
      view: 'table',
      table: grid,
      blanks,
      expected,
      checkCell,
      reveal,
      answer: reveal,
      hint: q.hint,
      ...extra.props,
    },
    check,
  );
}

/** Tuple (coordonnées, vecteurs) : vérifie composante par composante. */
function tupleCheck(expectedText, labels) {
  const expected = parseTuple(expectedText);
  return (v) => {
    const got = parseTuple(v, expected?.length);
    if (!got) return { ok: false, items: [itemBad(`Donne ${expected.length} valeurs, séparées par « ; » : (x ; y).`)] };
    if (got.length !== expected.length) {
      return { ok: false, items: [itemBad(`Il faut ${expected.length} valeurs, tu en donnes ${got.length}.`)] };
    }
    const items = expected.map((e, i) => {
      const name = labels[i] ?? `Composante ${i + 1}`;
      const right = Math.abs(got[i] - e) <= 1e-6 * (1 + Math.abs(e));
      return right ? itemOk(`${name} : correcte.`) : itemBad(`${name} : ${fmtShort(got[i])} (à revoir).`);
    });
    return { ok: tuplesEqual(got, expected), items };
  };
}

// ---------- Registre ----------

const SPECS = {
  // ===== Formats de base =====

  single_choice: {
    label: 'QCM',
    kind: 'theory',
    view: 'choice',
    needs: (q) => Boolean(q.template) || nonEmptyArr(q.distractors, 1),
    build: (q, base, { inst }) => {
      const wrong = inst ? distractorsFor(inst.value, inst.decimals) : shuffle(q.distractors).slice(0, 3);
      return choiceFrom(base, base.answer, wrong, { why: q.why });
    },
  },

  multi_choice: {
    label: 'QCM à réponses multiples',
    kind: 'theory',
    view: 'multi',
    needs: (q) => nonEmptyArr(q.answers, 2),
    build: (q, base) => {
      const wrong = shuffle(q.distractors ?? []).slice(0, 3);
      const check = (sel) => {
        const missed = q.answers.filter((a) => !sel.includes(a));
        const extra = sel.filter((s) => !q.answers.includes(s));
        if (!missed.length && !extra.length) return { ok: true, items: [itemOk('Toutes les bonnes réponses sont cochées.')] };
        const items = [itemInfo(`Bonnes réponses trouvées : ${q.answers.length - missed.length}/${q.answers.length}.`)];
        if (missed.length) items.push(itemWarn(`Oubliées : ${missed.join(', ')}.`));
        if (extra.length) items.push(itemBad(`Fausses : ${extra.join(', ')}.`));
        return { ok: false, items };
      };
      return withCheck(
        {
          ...base,
          view: 'multi',
          answers: q.answers,
          options: shuffle([...q.answers, ...wrong]),
          reveal: q.answers.join(' · '),
        },
        check,
      );
    },
  },

  true_false: {
    label: 'Vrai ou faux',
    kind: 'theory',
    view: 'choice',
    needs: (q) => nonEmptyArr(q.distractors, 1),
    build: (q, base) => {
      const isTrue = Math.random() < 0.5;
      const statement = isTrue ? q.answer : shuffle(q.distractors)[0];
      return {
        ...base,
        statement,
        isTrue,
        choices: [
          { value: true, label: 'Vrai' },
          { value: false, label: 'Faux' },
        ],
        correct: isTrue,
        why: q.why ? { true: q.why.true, false: q.why.false } : undefined,
        reveal: isTrue ? 'Vrai' : 'Faux',
      };
    },
  },

  flashcard: {
    label: 'Flashcard',
    kind: 'theory',
    view: 'self',
    needs: (q) => str(q.answer),
    build: (q, base) => ({ ...base, write: false, revealLabel: 'Voir la réponse', checklist: [] }),
  },

  fill_blank: {
    label: 'Texte à trous',
    kind: 'practice',
    view: 'cloze',
    needs: (q) => Boolean(blanksOf(q)),
    build: (q, base) => clozeExercise(q.cloze, blanksOf(q), base),
  },

  ordering: {
    label: 'Remettre dans l’ordre',
    kind: 'theory',
    view: 'ordering',
    needs: (q) => nonEmptyArr(q.steps, 2),
    build: (q, base) => orderingExercise(base, q.steps),
  },

  matching: {
    label: 'Association',
    kind: 'theory',
    view: 'matching',
    needs: (q) => nonEmptyArr(q.pairs, 2),
    build: (q, base) => matchingExercise(q, base),
  },

  numeric: {
    label: 'Calcul',
    kind: 'practice',
    view: 'numeric',
    needs: (q) => Boolean(q.template) || isNumberLike(q.answer),
    build: (q, base, { inst }) => numericExercise(q, base, inst),
  },

  // ===== Réponses ouvertes et saisies =====

  short_answer: {
    label: 'Réponse courte',
    kind: 'practice',
    view: 'text',
    needs: (q) => str(q.answer),
    build: (q, base) =>
      textExercise(
        base,
        (v) => {
          if (matchesAny(v, [q.answer, ...(q.accepts ?? [])])) return { ok: true, items: [itemOk('Bonne réponse.')] };
          if (q.evaluation) return semanticCheck(v, q.evaluation);
          // Faute de frappe : on accepte si c'est très proche, en le signalant.
          const near = [q.answer, ...(q.accepts ?? [])].some((a) => similarity(v, a) >= 0.85);
          if (near) return { ok: true, items: [itemWarn(`Presque : vérifie l’orthographe (attendu « ${q.answer} »).`)] };
          return { ok: false, items: [itemBad(`Réponse attendue : « ${q.answer} ».`)] };
        },
        { placeholder: q.placeholder ?? 'Ta réponse' },
      ),
  },

  long_answer: {
    label: 'Réponse développée',
    kind: 'practice',
    view: 'text',
    needs: (q) => str(q.answer) || nonEmptyArr(q.sections),
    build: (q, base) =>
      textExercise(
        base,
        (v) => openTextCheck(q, v, { minWords: 8 }),
        {
          placeholder: q.placeholder ?? 'Développe ta réponse...',
          multiline: true,
          checklist: q.evaluation ? groupItems(q.evaluation, null) : [],
          hint: q.hint,
        },
      ),
  },

  math_expression: {
    label: 'Expression mathématique',
    kind: 'practice',
    view: 'text',

    needs: (q) => (str(q.expected) && Boolean(q.variables)) || Boolean(q.calculation?.expression) || str(q.answer),

    build: (q, base) => {
      if (str(q.expected) && q.variables) return buildTemplateMath(q, base);
      if (q.calculation?.expression) return buildCalculation(q, base);

      const expected = q.answer;
      return textExercise(
        base,
        (v) => {
          if (anyEquiv(v, [expected, ...(q.accepts ?? [])])) {
            return { ok: true, items: [itemOk('Expression équivalente.')] };
          }
          return { ok: false, items: [itemBad('Expression non équivalente à la bonne réponse.'), ...expressionHint(v, expected)] };
        },
        {
          placeholder: q.placeholder ?? 'ex. 5x+3',
          mono: true,
          hint: 'Écris la formule : 2x ou 2*x, x^2 pour x².',
        },
      );
    },
  },

  code_answer: {
    label: 'Réponse en code',
    kind: 'practice',
    view: 'self',
    needs: (q) => str(q.answer),
    build: (q, base) => {
      const checks = [{ label: 'Parenthèses et crochets équilibrés', test: (t) => checkBrackets(t) }];
      if (str(q.mustDefine)) {
        const re = new RegExp(`\\b(def|function|fonction)\\s+${q.mustDefine}\\b`);
        checks.push({ label: `Définit la fonction « ${q.mustDefine} »`, test: (t) => re.test(t) });
      }
      return selfExercise(q, base, { mono: true, lang: q.lang, checklistExtra: checks });
    },
  },

  proof: {
    label: 'Preuve libre',
    kind: 'practice',
    view: 'self',
    needs: (q) => str(q.answer),
    build: (q, base) => selfExercise(q, base),
  },

  guided_proof: {
    label: 'Preuve guidée',
    kind: 'practice',
    view: 'cloze',
    needs: (q) => Boolean(blanksOf(q)),
    build: (q, base) => clozeExercise(q.cloze, blanksOf(q), base, { hint: q.hint }),
  },

  proof_completion: {
    label: 'Preuve à trous',
    kind: 'practice',
    view: 'cloze',
    needs: (q) => Boolean(blanksOf(q)),
    build: (q, base) => clozeExercise(q.cloze, blanksOf(q), base, { hint: q.hint }),
  },

  proof_reordering: {
    label: 'Preuve à ordonner',
    kind: 'theory',
    view: 'ordering',
    needs: (q) => nonEmptyArr(q.steps, 2),
    build: (q, base) => orderingExercise(base, q.steps),
  },

  proof_error_detection: {
    label: 'Preuve à erreur',
    kind: 'theory',
    view: 'choice',
    needs: (q) =>
      nonEmptyArr(q.steps, 2) && Number.isInteger(q.error) && q.error >= 0 && q.error < q.steps.length,
    build: (q, base) => ({
      ...base,
      prompt: base.prompt || 'Quelle étape de la preuve est incorrecte ?',
      choices: q.steps.map((s, i) => ({ value: i, label: `${i + 1}. ${s}` })),
      correct: q.error,
      why: q.why ?? { [q.error]: q.explanation },
      reveal: `Étape ${q.error + 1} : ${q.steps[q.error]}`,
    }),
  },

  justify_answer: {
    label: 'Réponse avec justification',
    kind: 'practice',
    view: 'justify',
    needs: (q) => str(q.answer),
    build: (q, base) => {
      const accepts = [q.answer, ...(q.accepts ?? [])];
      const same = (a) =>
        matchesAny(a, accepts) ||
        anyEquiv(a, accepts) ||
        accepts.some((x) => parseValue(a) !== null && numbersEqual(parseValue(a), parseValue(x)));
      const checkJustification = (j) => {
        if (!str(j)) return { ok: false, items: [itemBad('Justifie ta réponse.')] };
        if (q.evaluation) return semanticCheck(j, q.evaluation);
        if (str(q.justification)) return coverageCheck(q.justification, j, { minRatio: 0.4, minWords: q.minWords ?? 5 });
        return { ok: true, items: [] };
      };
      const check = ({ answer, justification }) => {
        const a = same(answer);
        const j = checkJustification(justification);
        return {
          ok: a && j.ok,
          items: [a ? itemOk('Réponse juste.') : itemBad('Réponse fausse ou incomplète.'), ...j.items],
        };
      };
      return withCheck(
        {
          ...base,
          view: 'justify',
          answerLabel: q.answerLabel ?? 'Réponse',
          justifyLabel: q.justifyLabel ?? 'Justification',
          reveal: str(q.justification) ? `${q.answer} — ${q.justification}` : base.answer,
          checklist: q.evaluation ? groupItems(q.evaluation, null) : [],
        },
        check,
      );
    },
  },

  // ===== Calcul =====

  numeric_answer: {
    label: 'Réponse numérique',
    kind: 'practice',
    view: 'numeric',
    needs: (q) => Boolean(q.template) || isNumberLike(q.answer) || nonEmptyArr(q.range, 2),
    build: (q, base, { inst }) => numericExercise(q, base, inst),
  },

  equation_solver: {
    label: 'Résolution d’équation',
    kind: 'practice',
    view: 'text',
    needs: (q) => Boolean(solutionSet(q.answer ?? (q.solutions ?? []).join(' ; '))),
    build: (q, base) => {
      const expected = solutionSet(q.answer ?? q.solutions.join(' ; '));
      const eq = str(q.equation) ? q.equation : null;
      const check = (v) => {
        const got = solutionSet(v);
        if (!got) {
          return { ok: false, items: [itemBad('Je n’ai pas reconnu les solutions : sépare-les par « ; » (ex. S = {2 ; -3}).')] };
        }
        const items = [];
        if (eq) {
          residuals(eq, got).forEach(({ x, residual }) => {
            items.push(
              Math.abs(residual) < 1e-6
                ? itemOk(`x = ${fmtShort(x)} vérifie l’équation.`)
                : itemBad(`x = ${fmtShort(x)} ne vérifie pas l’équation (écart ${fmtShort(residual)}).`),
            );
          });
        }
        const found = expected.filter((e) => got.some((g) => Math.abs(g - e) < 1e-6)).length;
        const extra = got.filter((g) => !expected.some((e) => Math.abs(g - e) < 1e-6));
        if (found < expected.length) {
          const n = expected.length - found;
          items.push(itemWarn(`Il manque ${n} solution${n > 1 ? 's' : ''}.`));
        }
        if (extra.length && !eq) items.push(itemBad('Une des solutions proposées n’est pas solution.'));
        const ok = solutionsEqual(v, expected);
        if (ok) return { ok: true, items: [itemOk('Toutes les solutions sont justes.')] };
        return { ok: false, items };
      };
      return withCheck(
        {
          ...base,
          view: 'text',
          placeholder: 'S = { … }',
          hint: q.hint ?? 'Sépare les solutions par « ; ».',
          reveal: `S = { ${expected.map(fmtNum).join(' ; ')} }`,
          equation: eq,
        },
        check,
      );
    },
  },

  logic_circuit: {
    label: 'Circuit logique',
    kind: 'practice',
    view: 'parts',
    needs: (q) => {
      const src = q.mode === 'write' ? q.target : q.expression;
      return str(src) && Boolean(safe(() => truthTable(src)));
    },
    build: (q, base) => {
      if (q.mode === 'write') {
        const target = q.target;
        const { vars, rows } = truthTable(target);
        const check = (v) => {
          if (!str(v)) return { ok: false, items: [] };
          if (!safe(() => truthTable(v))) {
            return {
              ok: false,
              items: [itemWarn('Expression non lisible : utilise les variables et ! & | ^ (ou ¬ ∧ ∨ ⊕) avec des parenthèses.')],
            };
          }
          if (logicEquivalent(v, target)) return { ok: true, items: [itemOk('Même table de vérité que le circuit demandé.')] };
          const diffs = logicDiffRows(v, target, 2).map((r) =>
            itemBad(
              `Pour ${Object.entries(r.env).map(([k, b]) => `${k}=${b}`).join(', ')}, ton expression donne ${r.got} au lieu de ${r.want}.`,
            ),
          );
          return { ok: false, items: diffs };
        };
        const tableText = rows.map((r) => `${vars.map((x, k) => `${x}=${r.bits[k]}`).join(' ')} → ${r.value}`).join('\n');
        return withCheck(
          {
            ...base,
            view: 'text',
            mono: true,
            prompt: base.prompt || 'Écris une expression logique qui donne cette table de vérité.',
            code: tableText,
            placeholder: 'ex. A & !B',
            hint: 'Opérateurs : ! ou ¬ (non), & ou ∧ (et), | ou ∨ (ou), ^ ou ⊕ (ou exclusif).',
            reveal: target,
          },
          check,
        );
      }

      const { vars, rows } = truthTable(q.expression);
      const parts = rows.map((r) => ({
        label: vars.length ? vars.map((v, k) => `${v}=${r.bits[k]}`).join(' ; ') : 'sortie',
        answer: String(r.value),
        kind: 'bit',
      }));
      return partsExercise(base, parts, {
        prompt: base.prompt || 'Donne la sortie du circuit pour chaque combinaison.',
        formula: q.expression,
        reveal: rows.map((r) => r.value).join(' '),
      });
    },
  },

  induction_proof: {
    label: 'Démonstration par récurrence',
    kind: 'practice',
    view: 'self',
    needs: (q) => nonEmptyArr(q.sections) || str(q.answer),
    build: (q, base) => selfExercise(q, base),
  },

  expression_simplification: {
    label: 'Simplification d’expression',
    kind: 'practice',
    view: 'text',
    needs: (q) => str(q.answer),
    build: (q, base) =>
      textExercise(
        base,
        (v) => {
          if (!equivalentExpressions(v, q.answer)) {
            return { ok: false, items: [itemBad('Ce n’est pas équivalent à l’expression de départ.')] };
          }
          if (q.expression && normalize(v) === normalize(q.expression)) {
            return { ok: false, items: [itemBad('Tu n’as pas simplifié : l’expression est restée identique.')] };
          }
          if (v.trim().length > String(q.answer).length + 2) {
            return { ok: false, items: [itemWarn('Correct, mais tu peux simplifier davantage.')] };
          }
          return { ok: true, items: [itemOk('Expression équivalente et simplifiée.')] };
        },
        {
          placeholder: 'Expression simplifiée',
          mono: true,
          hint: q.hint ?? 'Écris l’expression la plus simple possible.',
        },
      ),
  },

  matrix_operation: {
    label: 'Opération de matrice',
    kind: 'practice',
    view: 'table',
    needs: (q) => Boolean(gridBlanks(q)),
    build: (q, base) => tableExercise(q, base),
  },

  confusion_matrix: {
    label: 'Matrice de confusion',
    kind: 'practice',
    view: 'table',
    needs: (q) => Boolean(gridBlanks(q)),
    build: (q, base) => tableExercise(q, base, { metrics: confusionMetrics }),
  },

  probability_tree: {
    label: 'Arbre de probabilité',
    kind: 'practice',
    view: 'parts',
    needs: (q) => Boolean(partsOf(q.paths ?? q.parts, 'number')),
    build: (q, base) =>
      partsExercise(base, partsOf(q.paths ?? q.parts, 'number'), {
        prompt: base.prompt || 'Calcule la probabilité de chaque chemin de l’arbre.',
        hint: q.hint ?? 'Une probabilité s’écrit en décimal, en fraction (1/4) ou en pourcentage (25 %).',
      }),
  },

  sequence_completion: {
    label: 'Complétion de séquence',
    kind: 'practice',
    view: 'parts',
    needs: (q) => Boolean(partsOf(q.parts, 'number')),
    build: (q, base) =>
      partsExercise(base, partsOf(q.parts, 'number'), { formula: q.formula, hint: q.hint }),
  },

  multi_step_calculation: {
    label: 'Calcul à plusieurs étapes',
    kind: 'practice',
    view: 'parts',
    needs: (q) => Boolean(partsOf(q.parts, 'number')),
    build: (q, base) => partsExercise(base, partsOf(q.parts, 'number'), { hint: q.hint }),
  },

  function_analysis: {
    label: 'Analyse de fonction',
    kind: 'practice',
    view: 'parts',
    needs: (q) => Boolean(partsOf(q.parts, 'text')),
    build: (q, base) => partsExercise(base, partsOf(q.parts, 'text'), { formula: q.formula, hint: q.hint }),
  },

  coordinate_answer: {
    label: 'Réponse en coordonnées',
    kind: 'practice',
    view: 'text',
    needs: (q) => parseTuple(q.answer, 2)?.length === 2,
    build: (q, base) =>
      textExercise(base, tupleCheck(q.answer, ['Abscisse', 'Ordonnée']), { placeholder: '(x ; y)' }),
  },

  interval_answer: {
    label: 'Réponse en intervalle',
    kind: 'practice',
    view: 'text',
    needs: (q) => canonicalIntervals(q.answer) !== null,
    build: (q, base) => {
      const endpoints = (s) => (String(s).match(/[-+]?\d+(?:[.,]\d+)?|∞/g) ?? []).map((x) => x.replace(',', '.')).sort().join(' ');
      const check = (v) => {
        if (checkAnswer('interval', v, q.answer)) return { ok: true, items: [itemOk('Intervalle correct.')] };
        if (!canonicalIntervals(v)) {
          return { ok: false, items: [itemBad('Intervalle mal écrit : utilise [a ; b], ]a ; b[ et ∪ entre les morceaux.')] };
        }
        const items = [itemBad('Intervalle incorrect.')];
        if (endpoints(v) === endpoints(q.answer)) items.push(itemWarn('Mêmes bornes, mais vérifie les crochets (ouvert ] ou [ fermé).'));
        return { ok: false, items };
      };
      return textExercise(base, check, {
        placeholder: '[a ; b[ ∪ …',
        hint: 'Utilise les crochets ; ∞ ou inf pour l’infini.',
      });
    },
  },

  vector_operation: {
    label: 'Opération sur des vecteurs',
    kind: 'practice',
    view: 'text',
    needs: (q) => (parseTuple(q.answer, 2)?.length ?? 0) >= 2,
    build: (q, base) =>
      textExercise(base, tupleCheck(q.answer, ['Composante 1', 'Composante 2', 'Composante 3']), {
        placeholder: '(x ; y)',
        hint: 'Donne les coordonnées du vecteur, séparées par « ; ».',
      }),
  },

  // ===== Raisonnement et estimation =====

  counterexample: {
    label: 'Contre-exemple',
    kind: 'practice',
    view: 'self',
    needs: (q) => str(q.answer) || (str(q.hypothesis) && str(q.conclusion)),
    build: (q, base) => {
      if (str(q.hypothesis) && str(q.conclusion)) {
        const name = q.variable ?? 'x';
        const check = (v) => {
          const r = checkCounterexample(v, q.hypothesis, q.conclusion, name);
          if (r.reason === 'format') return { ok: false, items: [itemBad('Donne une valeur numérique.')] };
          if (r.reason === 'syntax') return { ok: false, items: [itemWarn('L’hypothèse ou la conclusion est mal écrite dans l’énoncé.')] };
          if (r.ok) {
            return { ok: true, items: [itemOk(`Contre-exemple valide : pour ${name} = ${v.trim()}, l’hypothèse est vraie et la conclusion fausse.`)] };
          }
          if (r.reason === 'hypothesis') {
            return { ok: false, items: [itemBad(`Pour ${name} = ${v.trim()}, l’hypothèse « ${pretty(q.hypothesis)} » n’est pas vérifiée.`)] };
          }
          return { ok: false, items: [itemBad(`Pour ${name} = ${v.trim()}, la conclusion « ${pretty(q.conclusion)} » est aussi vraie : ce n’est pas un contre-exemple.`)] };
        };
        return withCheck(
          {
            ...base,
            view: 'text',
            placeholder: q.placeholder ?? `Une valeur de ${name}`,
            hint: `Hypothèse : ${pretty(q.hypothesis)} · Conclusion : ${pretty(q.conclusion)}`,
            reveal: str(q.answer) ? q.answer : `${name} tel que ${q.hypothesis} et non (${q.conclusion})`,
          },
          check,
        );
      }
      return selfExercise(q, base);
    },
  },

  case_analysis: {
    label: 'Analyse de cas',
    kind: 'practice',
    view: 'parts',
    needs: (q) => Boolean(partsOf(q.parts, 'text')),
    build: (q, base) => partsExercise(base, partsOf(q.parts, 'text'), { hint: q.hint }),
  },

  estimate_answer: {
    label: 'Ordre de grandeur',
    kind: 'practice',
    view: 'numeric',
    needs: (q) => Boolean(q.template) || isNumberLike(q.answer),
    build: (q, base, { inst }) => numericExercise(q, base, inst, { mode: 'magnitude' }),
  },

  recursive_trace: {
    label: 'Trace récursive',
    kind: 'practice',
    view: 'parts',
    needs: (q) => Boolean(partsOf(q.parts, 'number')),
    build: (q, base) => partsExercise(base, partsOf(q.parts, 'number'), { code: q.code, hint: q.hint }),
  },

  // ===== Programmation =====

  code_completion: {
    label: 'Complétion de code',
    kind: 'practice',
    view: 'cloze',
    needs: (q) => Boolean(blanksOf(q, q.code)),
    build: (q, base) => clozeExercise(q.code, blanksOf(q, q.code), base, { mono: true, hint: q.hint }),
  },

  debugging: {
    label: 'Débogage',
    kind: 'practice',
    view: 'self',
    needs: (q) => str(q.code) && str(q.answer),
    build: (q, base) =>
      selfExercise(q, base, {
        mono: true,
        code: q.code,
        diffFrom: q.code,
        prompt: base.prompt || 'Corrige le programme.',
        checklistExtra: [{ label: 'Parenthèses et crochets équilibrés', test: (t) => checkBrackets(t) }],
      }),
  },

  code_output: {
    label: 'Résultat de code',
    kind: 'practice',
    view: 'text',
    needs: (q) => str(q.code) && str(q.answer),
    build: (q, base) =>
      textExercise(
        base,
        (v) => {
          if (normalizeOutput(v) === normalizeOutput(q.answer)) return { ok: true, items: [itemOk('Sortie identique.')] };
          const diff = lineDiff(normalizeOutput(q.answer), normalizeOutput(v)).filter((d) => d.k !== 'same');
          return { ok: false, items: [itemDiff('Lignes différentes (attendu / saisi)', diff)] };
        },
        {
          multiline: true,
          mono: true,
          code: q.code,
          placeholder: 'Ce que le programme affiche',
        },
      ),
  },

  execution_trace: {
    label: 'Trace d’exécution',
    kind: 'practice',
    view: 'table',
    needs: (q) => Boolean(gridBlanks(q)),
    build: (q, base) => tableExercise(q, base, { props: { code: q.code } }),
  },

  refactoring: {
    label: 'Amélioration de code',
    kind: 'practice',
    view: 'self',
    needs: (q) => str(q.code) && str(q.answer),
    build: (q, base) =>
      selfExercise(q, base, {
        mono: true,
        code: q.code,
        diffFrom: q.code,
        prompt: base.prompt || 'Améliore ce code sans changer son comportement.',
        checklistExtra: [
          { label: 'Plus court que l’original', test: (t) => t.trim().split('\n').length < q.code.split('\n').length },
          { label: 'Parenthèses et crochets équilibrés', test: (t) => checkBrackets(t) },
        ],
      }),
  },

  complexity_analysis: {
    label: 'Analyse de complexité',
    kind: 'practice',
    view: 'parts',
    needs: (q) => Boolean(partsOf(q.parts, 'complexity')),
    build: (q, base) =>
      partsExercise(base, partsOf(q.parts, 'complexity'), {
        hint: q.hint ?? 'Écris la notation de Landau, par exemple O(n²) ou Θ(n log n).',
      }),
  },

  // ===== Langues =====

  translation: {
    label: 'Traduction',
    kind: 'practice',
    view: 'text',
    needs: (q) => str(q.answer),
    build: (q, base) =>
      textExercise(
        base,
        (v) => {
          if (matchesAny(v, [q.answer, ...(q.accepts ?? [])])) return { ok: true, items: [itemOk('Traduction correcte.')] };
          if (similarity(v, q.answer) >= 0.9) {
            return { ok: true, items: [itemWarn(`Presque : vérifie l’orthographe (« ${q.answer} »).`)] };
          }
          const diff = wordDiff(q.answer, v).filter((d) => d.k !== 'same');
          return { ok: false, items: [itemBad('Traduction à revoir.'), itemDiff('Mots (attendu / saisi)', diff)] };
        },
        {
          placeholder: 'Ta traduction',
          hint: q.source ? `Texte source : ${q.source}` : undefined,
        },
      ),
  },

  speaking: {
    label: 'Expression orale',
    kind: 'practice',
    view: 'speak',
    needs: (q) => str(q.answer),
    build: (q, base) => ({
      ...withCheck(
        {
          ...base,
          target: q.answer,
          lang: q.lang ?? 'fr-FR',
        },
        (v) => {
          const sim = similarity(v, q.answer);
          if (sim >= 0.8) return { ok: true, items: [itemOk('Bonne expression orale.')] };
          const diff = wordDiff(q.answer, v).filter((d) => d.k !== 'same');
          return { ok: false, items: [itemBad('Ce qui a été entendu ne correspond pas assez.'), itemDiff('Mots (attendu / entendu)', diff)] };
        },
      ),
    }),
  },

  pronunciation: {
    label: 'Prononciation',
    kind: 'practice',
    view: 'speak',
    needs: (q) => str(q.answer),
    build: (q, base) =>
      withCheck(
        {
          ...base,
          target: q.answer,
          lang: q.lang ?? 'fr-FR',
        },
        (v) => {
          const sim = similarity(v, q.answer);
          if (sim >= 0.85) return { ok: true, items: [itemOk('Prononciation reconnue.')] };
          return {
            ok: false,
            items: [itemBad(`Reconnu : « ${v || '…'} ». Attendu : « ${q.answer} ». Réécoute le modèle et réessaie.`)],
          };
        },
      ),
  },

  listening: {
    label: 'Compréhension orale',
    kind: 'practice',
    view: 'text',
    needs: (q) => str(q.audio) && str(q.answer),
    build: (q, base) =>
      textExercise(
        base,
        (v) => {
          if (q.evaluation) return semanticCheck(v, q.evaluation);
          if (matchesAny(v, [q.answer, ...(q.accepts ?? [])])) return { ok: true, items: [itemOk('Bonne compréhension.')] };
          if (similarity(v, q.answer) >= 0.85) return { ok: true, items: [itemWarn('Presque : vérifie l’orthographe.')] };
          return { ok: false, items: [itemBad('Ce n’est pas ce que dit l’audio. Réécoute.')] };
        },
        {
          audio: { text: q.audio, lang: q.lang ?? 'fr-FR' },
          placeholder: 'Ta réponse',
        },
      ),
  },

  reading_comprehension: {
    label: 'Compréhension écrite',
    kind: 'theory',
    view: 'choice',
    needs: (q) => str(q.passage) && str(q.answer) && nonEmptyArr(q.distractors, 1),
    build: (q, base) =>
      choiceFrom(base, q.answer, shuffle(q.distractors).slice(0, 3), { passage: q.passage, why: q.why }),
  },

  conjugation: {
    label: 'Conjugaison',
    kind: 'practice',
    view: 'parts',
    needs: (q) => Boolean(partsOf(q.parts, 'text')),
    build: (q, base) => partsExercise(base, partsOf(q.parts, 'text'), { hint: q.hint }),
  },

  dialogue_completion: {
    label: 'Complétion de dialogue',
    kind: 'practice',
    view: 'cloze',
    needs: (q) => Boolean(blanksOf(q)),
    build: (q, base) => clozeExercise(q.cloze, blanksOf(q), base, { hint: q.hint }),
  },

  dictation: {
    label: 'Dictée',
    kind: 'practice',
    view: 'text',
    needs: (q) => str(q.audio ?? q.answer),
    build: (q, base) => {
      const target = q.answer ?? q.audio;
      return textExercise(
        base,
        (v) => {
          // Seuls la casse, les accents et la ponctuation sont ignorés : une faute d'orthographe reste une erreur.
          if (normalizeLoose(v) === normalizeLoose(target)) return { ok: true, items: [itemOk('Dictée parfaite.')] };
          const diff = wordDiff(target, v).filter((d) => d.k !== 'same');
          return { ok: false, items: [itemDiff('Mots à revoir (− manquant, + en trop)', diff)] };
        },
        {
          audio: { text: q.audio ?? q.answer, lang: q.lang ?? 'fr-FR' },
          placeholder: 'Écris ce que tu entends',
          reveal: target,
        },
      );
    },
  },

  vocabulary_matching: {
    label: 'Association de vocabulaire',
    kind: 'theory',
    view: 'matching',
    needs: (q) => nonEmptyArr(q.pairs, 2),
    build: (q, base) => matchingExercise(q, base),
  },

  contextual_vocabulary: {
    label: 'Mot en contexte',
    kind: 'theory',
    view: 'choice',
    needs: (q) => str(q.context) && str(q.answer) && nonEmptyArr(q.distractors, 1),
    build: (q, base) =>
      choiceFrom(base, q.answer, shuffle(q.distractors).slice(0, 3), { passage: q.context, why: q.why }),
  },

  word_order: {
    label: 'Ordre des mots',
    kind: 'practice',
    view: 'ordering',
    needs: (q) => nonEmptyArr(q.words ?? q.steps, 2),
    build: (q, base) => orderingExercise(base, q.words ?? q.steps),
  },

  conversation_roleplay: {
    label: 'Jeu de rôle',
    kind: 'theory',
    view: 'turns',
    needs: (q) =>
      nonEmptyArr(q.turns) &&
      q.turns.every(
        (t) =>
          nonEmptyArr(t.choices, 2) &&
          Number.isInteger(t.correct) &&
          t.correct >= 0 &&
          t.correct < t.choices.length,
      ),
    build: (q, base) => {
      const turns = q.turns.map((t) => ({
        say: t.say,
        speaker: t.speaker,
        correct: t.correct,
        notes: t.notes ?? [],
        choices: t.choices.map((c, i) => ({ value: i, label: c })),
      }));
      const check = (picks) => {
        const items = [];
        turns.forEach((t, i) => {
          if (picks[i] === t.correct) return;
          const note = t.notes[picks[i]];
          items.push(itemBad(`Réplique ${i + 1} : ${note ?? `la bonne réponse était « ${t.choices[t.correct].label} ».`}`));
        });
        if (!items.length) return { ok: true, items: [itemOk('Toutes les répliques sont adaptées.')] };
        return { ok: false, items };
      };
      return withCheck(
        { ...base, view: 'turns', turns, reveal: turns.map((t) => t.choices[t.correct].label).join(' · ') },
        check,
      );
    },
  },

  // ===== Sciences humaines et analyse =====

  source_analysis: {
    label: 'Analyse de document',
    kind: 'practice',
    view: 'self',
    needs: (q) => nonEmptyArr(q.sections) || str(q.answer),
    build: (q, base) => selfExercise(q, base),
  },

  historical_comparison: {
    label: 'Comparaison historique',
    kind: 'practice',
    view: 'self',
    needs: (q) => nonEmptyArr(q.sections) || str(q.answer),
    build: (q, base) => selfExercise(q, base),
  },

  scientific_calculation: {
    label: 'Calcul scientifique',
    kind: 'practice',
    view: 'numeric',
    needs: (q) => Boolean(q.template) || isNumberLike(q.answer),
    build: (q, base, { inst }) => numericExercise(q, base, inst, { defaultTolerance: { rel: 0.005 } }),
  },

  data_analysis: {
    label: 'Interprétation de données',
    kind: 'practice',
    view: 'self',
    needs: (q) => nonEmptyArr(q.sections) || str(q.answer),
    build: (q, base) => selfExercise(q, base),
  },

  // ===== Dessin, graphes et blocs =====

  graph_builder: {
    label: 'Graphe à construire',
    kind: 'practice',
    view: 'text',
    needs: (q) => str(q.answer) && Boolean(parseEdges(q.answer, Boolean(q.directed))),
    build: (q, base) => {
      const directed = Boolean(q.directed);
      const expected = parseEdges(q.answer, directed);
      const pretty = (k) => (directed ? k.replace('>', ' → ') : k.replace('-', ' – '));
      const check = (v) => {
        const got = parseEdges(v, directed);
        if (!got) return { ok: false, items: [itemBad('Format : une arête par « A-B », séparées par des virgules.')] };
        if (sameSet(got, expected)) return { ok: true, items: [itemOk('Graphe correct.')] };
        const missing = [...expected].filter((e) => !got.has(e)).map(pretty);
        const extra = [...got].filter((e) => !expected.has(e)).map(pretty);
        const items = [];
        if (missing.length) items.push(itemList('Arêtes manquantes', missing, 'warn'));
        if (extra.length) items.push(itemList('Arêtes en trop', extra, 'bad'));
        return { ok: false, items };
      };
      return textExercise(base, check, {
        multiline: true,
        placeholder: directed ? 'A>B, B>C' : 'A-B, B-C',
        hint: nonEmptyArr(q.vertices)
          ? `Sommets : ${q.vertices.join(', ')}. Sépare les arêtes par des virgules.`
          : 'Sépare les arêtes par des virgules.',
      });
    },
  },

  geometry_canvas: {
    label: 'Dessin géométrique',
    kind: 'practice',
    view: 'parts',
    needs: (q) =>
      Boolean(q.vertices) &&
      typeof q.vertices === 'object' &&
      Object.keys(q.vertices).length >= 2 &&
      Object.values(q.vertices).every((p) => Array.isArray(p) && p.length === 2),
    build: (q, base) => {
      const parts = Object.entries(q.vertices).flatMap(([name, [x, y]]) => [
        { label: `${name} : abscisse`, answer: String(x), kind: 'number', tolerance: { abs: 0.01 } },
        { label: `${name} : ordonnée`, answer: String(y), kind: 'number', tolerance: { abs: 0.01 } },
      ]);
      return partsExercise(base, parts, {
        prompt: base.prompt || 'Donne les coordonnées des sommets de la figure.',
        figure: q.vertices,
      });
    },
  },

  block_programming: {
    label: 'Programme par blocs',
    kind: 'theory',
    view: 'ordering',
    needs: (q) => nonEmptyArr(q.blocks ?? q.steps, 2),
    build: (q, base) => orderingExercise(base, q.blocks ?? q.steps),
  },

  // ===== Divers =====

  odd_one_out: {
    label: 'Intrus',
    kind: 'theory',
    view: 'choice',
    needs: (q) => str(q.answer) && nonEmptyArr(q.distractors, 2),
    build: (q, base) =>
      choiceFrom(base, q.answer, shuffle(q.distractors).slice(0, 3), {
        prompt: base.prompt || 'Lequel n’appartient pas à la liste ?',
        why: q.why,
      }),
  },

  table_completion: {
    label: 'Tableau à compléter',
    kind: 'practice',
    view: 'table',
    needs: (q) => Boolean(gridBlanks(q)),
    build: (q, base) => tableExercise(q, base),
  },
};

// ---------- API publique ----------

/** Libellé de chaque format (affiché à l'écran, utilisé pour les badges). */
export const FORMAT_LABELS = Object.fromEntries(Object.entries(SPECS).map(([id, s]) => [id, s.label]));

/** Formats de pratique : calcul, saisie, rédaction. Les autres sont des formats de théorie. */
export const PRACTICE_FORMATS = Object.keys(SPECS).filter((id) => SPECS[id].kind === 'practice');

/** Identifiants de tous les formats connus. */
export const FORMAT_IDS = Object.keys(SPECS);

/** Ne garde que les formats connus dont la question possède les données nécessaires. */
export function availableFormats(q) {
  return (q.formats ?? []).filter((f) => SPECS[f] && Boolean(safe(() => SPECS[f].needs(q))));
}

/** Transforme une question de la banque en exercice concret. Un gabarit est tiré à neuf à chaque appel. */
export function buildExercise(q, format) {
  const spec = SPECS[format];
  if (!spec) throw new Error(`Format inconnu : ${format}`);
  const inst = q.template ? instantiate(q.template) : null;
  const scope = inst?.scope ?? null;
  const answer = inst ? inst.answer : q.answer;
  const base = {
    format,
    kind: spec.kind,
    view: spec.view,
    prompt: inst ? inst.prompt : q.prompt,
    answer,
    reveal: answer === undefined || answer === null ? '' : String(answer),
    explain: explainsOf(q, scope),
  };
  return spec.build(q, base, { inst });
}

/** Explication d'un exercice (déjà remplie avec ses valeurs) selon le niveau demandé. */
export function explainOf(ex, level = 'normal') {
  const e = ex?.explain;
  if (!e) return '';
  return e[level] ?? e.normal ?? '';
}

export const EXPLAIN_LEVELS = [
  ['simple', 'Simple'],
  ['normal', 'Normale'],
  ['deep', 'Approfondie'],
];

/**
 * Explication selon le niveau demandé. Une question peut fournir
 * `explanations: { simple, deep }` ; sinon on retombe sur `explanation`.
 */
export function explanationFor(q, level = 'normal') {
  if (level === 'normal') return q.explanation;
  return q.explanations?.[level] ?? q.explanation;
}
