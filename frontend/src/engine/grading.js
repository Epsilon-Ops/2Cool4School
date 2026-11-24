/**
 * Fonctions de correction pures, partagées par tous les formats d'exercices.
 * Aucune dépendance à React : elles sont testables telles quelles.
 */
import { parseNumber, evaluate } from './template.js';

const fixMinus = (s) => String(s ?? '').replace(/−/g, '-');

/** Normalise une réponse libre : minuscules, sans accents, sans espaces. */
export function normalize(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');
}

/** Vrai si la réponse normalisée correspond à l'une des réponses acceptées. */
export function matchesAny(value, answers) {
  const v = normalize(value);
  if (!v) return false;

  return answers.some((a) => normalize(a) === v);
}

/** Sortie de programme : lignes sans espaces superflus ni lignes vides. */
export function normalizeOutput(s) {
  return String(s ?? '')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim().replace(/\s+/g, ' '))
    .filter((l) => l !== '')
    .join('\n');
}

/** Similarité entre deux textes, entre 0 et 1 (distance de Levenshtein normalisée). */
export function similarity(a, b) {
  const x = normalize(a);
  const y = normalize(b);
  if (!x && !y) return 1;
  const m = x.length;
  const n = y.length;
  if (!m || !n) return 0;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}

/**
 * Lit une valeur saisie : nombre (virgule ou point) ou fraction « 3/4 ».
 * Renvoie null si ce n'est pas une valeur.
 */
export function parseValue(text) {
  const s = fixMinus(text).trim();
  const pct = s.match(/^(-?[\d.,]+)\s*%$/);
  if (pct) {
    const n = parseNumber(pct[1]);
    return n === null ? null : n / 100;
  }
  const f = s.match(/^(-?\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)$/);
  if (f) {
    const den = parseNumber(f[2]);
    const num = parseNumber(f[1]);
    return den && num !== null ? num / den : null;
  }
  return parseNumber(s);
}

/** Nombre de décimales d'une réponse écrite (« 3,25 » → 2). */
export function decimalsOf(text) {
  const m = String(text ?? '').replace(',', '.').match(/\.(\d+)/);
  return m ? m[1].length : 0;
}

/**
 * Compare un nombre à sa valeur attendue.
 * - tolerance.rel : tolérance relative ; tolerance.abs : tolérance absolue ;
 * - sinon, tolérance d'une unité de la dernière décimale (ou 0,1 pour un entier) ;
 * - mode 'magnitude' : même ordre de grandeur (à un facteur 3 près).
 */
export function numbersEqual(got, expected, { decimals = 0, tolerance, mode } = {}) {
  if (got === null || got === undefined || !Number.isFinite(got)) return false;
  if (!Number.isFinite(expected)) return false;
  if (mode === 'magnitude') {
    if (expected === 0) return Math.abs(got) < 1e-9;
    if (got === 0 || Math.sign(got) !== Math.sign(expected)) return false;
    return Math.abs(Math.log10(Math.abs(got)) - Math.log10(Math.abs(expected))) < 0.5;
  }
  if (tolerance?.rel !== undefined) {
    return Math.abs(got - expected) <= tolerance.rel * Math.abs(expected) + 1e-12;
  }
  const abs = tolerance?.abs ?? 10 ** -(decimals + 1);
  return Math.abs(got - expected) < abs + 1e-12;
}

/**
 * n-uplet : « (2 ; -3) », « [1 2 3] », « 2, 5 ». Le point-virgule sépare en priorité ;
 * sans lui, la virgule ne sert de séparateur que si elle donne exactement n éléments.
 */
export function parseTuple(text, n) {
  const s = fixMinus(text).replace(/[()[\]{}]/g, ' ').trim();
  if (!s) return null;
  let parts;
  if (s.includes(';')) parts = s.split(';');
  else if (n && s.split(',').length === n) parts = s.split(',');
  else parts = s.split(/[,\s]+/);
  parts = parts.map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const nums = parts.map(parseValue);
  return nums.some((v) => v === null) ? null : nums;
}

export function tuplesEqual(got, expected) {
  if (!got || !expected || got.length !== expected.length) return false;
  return expected.every((e, i) => Math.abs(got[i] - e) <= 1e-6 * (1 + Math.abs(e)));
}

// ---------- Intervalles ----------

const endpoint = (s) => {
  const t = String(s).replace(/\s+/g, '');
  if (/^\+?(∞|inf|infini)$/i.test(t)) return Infinity;
  if (/^-(∞|inf|infini)$/i.test(t)) return -Infinity;
  return parseValue(t);
};

const fmtBound = (x) => (x === Infinity ? '+∞' : x === -Infinity ? '-∞' : String(Number(x.toFixed(10))));

/**
 * Forme canonique d'un intervalle ou d'une union : « [1;3[ », « ]-∞;2] ∪ [5;+∞[ ».
 * Accepte les notations [a;b], ]a;b[, (a;b) et ℝ. Renvoie null si la saisie n'est pas valide.
 */
export function canonicalIntervals(text) {
  const src = fixMinus(text).trim();
  if (/^(ℝ|R)$/.test(src)) return ']-∞;+∞[';
  const pieces = src.split(/\s*(?:∪|\bU\b)\s*/).map((p) => p.trim()).filter(Boolean);
  if (pieces.length === 0) return null;
  const out = [];
  for (const p of pieces) {
    const m = p.match(/^([[\]()])\s*(.+?)\s*;\s*(.+?)\s*([[\]()])$/);
    if (!m) return null;
    const lo = endpoint(m[2]);
    const hi = endpoint(m[3]);
    if (lo === null || hi === null || lo > hi) return null;
    out.push({
      lo,
      hi,
      loClosed: m[1] === '[' && lo !== -Infinity,
      hiClosed: m[4] === ']' && hi !== Infinity,
    });
  }
  out.sort((a, b) => a.lo - b.lo || a.hi - b.hi);
  return out
    .map((i) => `${i.loClosed ? '[' : ']'}${fmtBound(i.lo)};${fmtBound(i.hi)}${i.hiClosed ? ']' : '['}`)
    .join('∪');
}

// ---------- Équations : ensembles de solutions ----------

/** Liste triée des solutions saisies : « S = {2 ; -3} », « 2 ou -3 », « 2, 5 ». */
export function solutionSet(text) {
  const s = fixMinus(text)
    .replace(/^\s*[A-Za-zS]\s*=\s*/, '')
    .replace(/[{}]/g, '')
    .replace(/\bou\b|\bor\b|\|/gi, ';');
  const parts = s.includes(';') ? s.split(';') : s.split(',');
  const nums = parts.map((t) => t.trim()).filter(Boolean).map(parseValue);
  if (nums.length === 0 || nums.some((v) => v === null)) return null;
  return nums.sort((a, b) => a - b);
}

export function solutionsEqual(text, expected) {
  const got = solutionSet(text);
  if (!got || got.length !== expected.length) return false;
  return got.every((v, i) => Math.abs(v - expected[i]) < 1e-6);
}

// ---------- Graphes ----------

/** Ensemble des arêtes saisies (« A-B, B-C »). Non orienté par défaut. */
export function parseEdges(text, directed = false) {
  const out = new Set();
  for (const raw of String(text ?? '').split(/[,;\n]+/)) {
    const t = raw.trim();
    if (!t) continue;
    const m = t.match(/^(\S+?)\s*(?:->|→|–|—|-)\s*(\S+)$/);
    if (!m) return null;
    const a = m[1];
    const b = m[2];
    out.add(directed ? `${a}>${b}` : [a, b].sort().join('-'));
  }
  return out;
}

export function sameSet(a, b) {
  if (!a || !b || a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

// ---------- Expressions mathématiques ----------

const SEEDS = [0.5, 1.5, -2.25, 3, 0.75, -1.5, 2.5];

/** Multiplication implicite : « 2x » → « 2*x », « 3(x+1) » → « 3*(x+1) ». */
export const preparse = (s) =>
  fixMinus(s).replace(/\*\*/g, '^').replace(/(\d|\))(?=\s*[A-Za-z(])/g, '$1*');

function sameExpression(a, b) {
  const A = preparse(a);
  const B = preparse(b);
  const ids = [...new Set([...(`${A} ${B}`).matchAll(/[A-Za-z_]\w*/g)].map((m) => m[0]))];
  for (let k = 0; k < SEEDS.length; k++) {
    const scope = {};
    ids.forEach((id, i) => {
      scope[id] = SEEDS[(k + i * 3) % SEEDS.length];
    });
    let x;
    let y;
    try {
      x = evaluate(A, scope);
      y = evaluate(B, scope);
    } catch {
      return false;
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      if (x !== y && !(Number.isNaN(x) && Number.isNaN(y))) return false;
      continue;
    }
    if (Math.abs(x - y) > 1e-7 * (1 + Math.abs(y))) return false;
  }
  return true;
}

/**
 * Deux expressions sont égales si elles prennent les mêmes valeurs pour toutes les variables
 * (testé en plusieurs points). Pour une équation « x = 4 », les deux membres sont comparés.
 */
export function equivalentExpressions(a, b) {
  const sa = String(a ?? '');
  const sb = String(b ?? '');
  if (!sa.trim() || !sb.trim()) return false;
  const ea = sa.split('=');
  const eb = sb.split('=');
  if (ea.length !== eb.length || ea.length > 2) return false;
  if (ea.length === 1) return sameExpression(sa, sb);
  return (sameExpression(ea[0], eb[0]) && sameExpression(ea[1], eb[1]))
      || (sameExpression(ea[0], eb[1]) && sameExpression(ea[1], eb[0]));
}

// ---------- Logique booléenne ----------

/**
 * Syntaxe : variables (A, B, p1…), constantes 0 et 1, ¬ ! NOT, ∧ & AND, ∨ | OR, ⊕ ^ XOR, parenthèses.
 * Priorités : ¬ > ∧ > (∨ et ⊕, de gauche à droite). Utiliser des parenthèses pour lever le doute.
 */
function tokenizeBool(src) {
  const s = String(src ?? '')
    .replace(/¬|~/g, '!')
    .replace(/∧/g, '&')
    .replace(/∨/g, '|')
    .replace(/⊕/g, '^')
    .replace(/\bNOT\b/g, '!')
    .replace(/\bAND\b/g, '&')
    .replace(/\bOR\b/g, '|')
    .replace(/\bXOR\b/g, '^')
    .replace(/\s+/g, '');
  const toks = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < s.length && /\w/.test(s[j])) j++;
      toks.push({ t: 'id', v: s.slice(i, j) });
      i = j;
    } else if (c === '0' || c === '1') {
      toks.push({ t: 'const', v: Number(c) });
      i++;
    } else if ('!&|^()'.includes(c)) {
      toks.push({ t: 'op', v: c });
      i++;
    } else {
      throw new Error(`Caractère inattendu : « ${c} »`);
    }
  }
  return toks;
}

/** Variables d'une expression booléenne, triées. */
export function logicVars(src) {
  const ids = tokenizeBool(src).filter((t) => t.t === 'id').map((t) => t.v);
  return [...new Set(ids)].sort();
}

/** Évalue une expression booléenne avec des valeurs 0/1 pour chaque variable. */
export function evalBool(src, vars) {
  const toks = tokenizeBool(src);
  let p = 0;
  const isOp = (v) => toks[p]?.t === 'op' && toks[p].v === v;
  function atom() {
    const t = toks[p++];
    if (!t) throw new Error('Expression incomplète');
    if (t.t === 'const') return t.v;
    if (t.t === 'id') {
      if (!(t.v in vars)) throw new Error(`Variable inconnue : ${t.v}`);
      return vars[t.v] ? 1 : 0;
    }
    if (t.v === '(') {
      const v = orExpr();
      if (!isOp(')')) throw new Error('Parenthèse manquante');
      p++;
      return v;
    }
    throw new Error(`Opérateur inattendu : ${t.v}`);
  }
  function unary() {
    if (isOp('!')) {
      p++;
      return 1 - unary();
    }
    return atom();
  }
  function andExpr() {
    let v = unary();
    while (isOp('&')) {
      p++;
      v = v & unary();
    }
    return v;
  }
  function orExpr() {
    let v = andExpr();
    while (isOp('|') || isOp('^')) {
      const op = toks[p++].v;
      const r = andExpr();
      v = op === '|' ? v | r : v ^ r;
    }
    return v;
  }
  const value = orExpr();
  if (p !== toks.length) throw new Error('Expression mal formée');
  return value;
}

/** Table de vérité complète : une ligne par combinaison, première variable = bit de poids fort. */
export function truthTable(src) {
  const vars = logicVars(src);
  const rows = [];
  for (let m = 0; m < 2 ** vars.length; m++) {
    const bits = vars.map((_, k) => (m >> (vars.length - 1 - k)) & 1);
    const env = Object.fromEntries(vars.map((v, k) => [v, bits[k]]));
    rows.push({ bits, value: evalBool(src, env) });
  }
  return { vars, rows };
}

// ---------- Tableaux ----------

/** Une case de tableau : nombre si la réponse attendue en est un, sinon texte. */
export function cellMatches(raw, expected) {
  if (parseValue(expected) !== null) {
    return checkAnswer('number', raw, expected);
  }
  return matchesAny(raw, [expected]);
}

// ---------- Vérification générique d'une partie ----------

/**
 * Vérifie une réponse selon sa nature :
 * number, bit (0/1), interval, solutions, tuple, expression, text (avec variantes acceptées).
 */
export function checkAnswer(kind, raw, expected, { accepts = [], tolerance, decimals, mode } = {}) {
  switch (kind) {
    case 'number': {
      const v = parseValue(raw);
      const e = parseValue(expected);
      return v !== null && e !== null && numbersEqual(v, e, { tolerance, decimals, mode });
    }
    case 'bit':
      return String(raw ?? '').trim() === String(expected).trim();
    case 'interval': {
      const got = canonicalIntervals(raw);
      return got !== null && got === canonicalIntervals(expected);
    }
    case 'solutions':
      return solutionsEqual(raw, solutionSet(expected) ?? []);
    case 'tuple': {
      const e = parseTuple(expected);
      return tuplesEqual(parseTuple(raw, e?.length), e);
    }
    case 'expression':
      return equivalentExpressions(raw, expected);
    case 'complexity':
      return normalizeComplexity(raw) === normalizeComplexity(expected)
        || accepts.some((a) => normalizeComplexity(raw) === normalizeComplexity(a));
    case 'text':
    default:
      return matchesAny(raw, [expected, ...accepts]);
  }
}

/** Normalisation souple pour la dictée : ignore aussi la ponctuation et les majuscules. */
export function normalizeLoose(s) {
  return normalize(s).replace(/[^\p{L}\p{N}]/gu, '');
}


// ---------- Texte : mots, termes et notions ----------

/** Mots d'un texte, en minuscules, sans accents ni ponctuation. */
export function tokenize(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Forme de base d'un mot : retire le pluriel et les terminaisons usuelles (vitesse ~ vitesses). */
const baseWord = (w) => (w.length > 3 ? w.replace(/(es|s|e|x)$/, '') : w);
const tokenEq = (a, b) => a === b || (baseWord(a) === baseWord(b) && baseWord(a).length >= 3);

/** Vrai si le terme (un ou plusieurs mots) apparaît dans les mots du texte, en mots entiers. */
export function hasTerm(tokens, term) {
  const t = tokenize(term);
  if (!t.length) return false;
  for (let i = 0; i + t.length <= tokens.length; i++) {
    if (t.every((w, j) => tokenEq(tokens[i + j], w))) return true;
  }
  return false;
}

const hitGroup = (tokens) => (group) => (Array.isArray(group) ? group : [group]).some((t) => hasTerm(tokens, t));

/**
 * Évaluation d'une réponse libre par notions.
 * evaluation : { required: [[termes…], …], labels?, forbidden?: [terme…],
 *                atLeast?: { count, groups, labels? }, minWords? }
 * Renvoie { ok, found: [{label, ok}], missing: [libellé…], forbidden: [terme…], empty }.
 */
export function evaluateSemantic(value, evaluation) {
  const tokens = tokenize(value);
  const out = { ok: false, empty: tokens.length === 0, found: [], missing: [], forbidden: [], optional: { found: 0, total: 0 } };
  if (!evaluation || !tokens.length) return out;
  const hit = hitGroup(tokens);
  // Groupes facultatifs : ils ne changent pas la réussite, ils signalent les précisions utiles.
  out.optional.total = (evaluation.optional ?? []).length;
  out.optional.found = (evaluation.optional ?? []).filter(hit).length;

  for (const term of evaluation.forbidden ?? []) {
    if (hasTerm(tokens, term)) out.forbidden.push(term);
  }
  (evaluation.required ?? []).forEach((g, i) => {
    const label = evaluation.labels?.[i] ?? (Array.isArray(g) ? g[0] : g);
    const ok = hit(g);
    out.found.push({ label, ok });
    if (!ok) out.missing.push(label);
  });
  if (evaluation.atLeast) {
    const { count, groups, labels } = evaluation.atLeast;
    const n = groups.filter(hit).length;
    if (n < count) {
      const names = labels ?? groups.map((g) => (Array.isArray(g) ? g[0] : g));
      out.missing.push(`au moins ${count} parmi : ${names.join(', ')}`);
    }
  }
  if (evaluation.minWords && tokens.length < evaluation.minWords) {
    out.missing.push(`une réponse plus développée (${evaluation.minWords} mots au moins)`);
  }
  out.ok = out.forbidden.length === 0 && out.missing.length === 0;
  return out;
}

export function matchesSemantic(value, evaluation) {
  return evaluateSemantic(value, evaluation).ok;
}

const STOP = new Set([
  'avec', 'dans', 'pour', 'sans', 'entre', 'parce', 'alors', 'donc', 'mais', 'cette', 'ces', 'elle', 'elles',
  'leur', 'leurs', 'plus', 'moins', 'tout', 'tous', 'toute', 'toutes', 'aussi', 'comme', 'sont', 'etre',
  'avoir', 'peut', 'peuvent', 'celui', 'celle', 'lorsque', 'quand', 'ainsi', 'bien', 'très', 'tres',
]);

/**
 * Couverture des notions clés d'un corrigé. Sert de contrôle quand aucune grille n'est fournie :
 * on repère les mots longs et non courants du corrigé, puis on regarde lesquels reviennent dans la réponse.
 */
export function keywordCoverage(model, typed, minLen = 6) {
  const keys = [...new Set(tokenize(model).filter((w) => w.length >= minLen && !STOP.has(w)))];
  const have = tokenize(typed);
  const missing = keys.filter((k) => !have.some((t) => tokenEq(t, k)));
  return { total: keys.length, found: keys.length - missing.length, missing };
}

/** Comparaison de deux suites (mots ou lignes) : liste de { k: 'same'|'del'|'add', w }. */
export function diffSeq(a, b, eq = (x, y) => x === y) {
  const n = a.length;
  const m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      L[i][j] = eq(a[i], b[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    }
  }
  const out = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) {
      out.push({ k: 'same', w: b[j] });
      i++;
      j++;
    } else if (L[i + 1][j] >= L[i][j + 1]) {
      out.push({ k: 'del', w: a[i++] });
    } else {
      out.push({ k: 'add', w: b[j++] });
    }
  }
  while (i < n) out.push({ k: 'del', w: a[i++] });
  while (j < m) out.push({ k: 'add', w: b[j++] });
  return out;
}

/** Différence mot à mot entre la réponse attendue et la saisie. 'del' = mot manquant, 'add' = mot en trop. */
export function wordDiff(expected, typed) {
  const split = (s) => String(s ?? '').split(/\s+/).filter(Boolean);
  return diffSeq(split(expected), split(typed), (x, y) => normalizeLoose(x) === normalizeLoose(y));
}

/** Différence ligne à ligne (sorties de programme, code). */
export function lineDiff(expected, typed) {
  const split = (s) => String(s ?? '').replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+$/, ''));
  return diffSeq(split(expected), split(typed), (x, y) => x.trim() === y.trim());
}

// ---------- Grandeurs avec unités ----------

/** Facteur de conversion vers l'unité de base de sa grandeur (L, A, V, M, T, E, P, F, Pr, S, U, I). */
const UNITS = {
  m: [1, 'L'], cm: [0.01, 'L'], mm: [0.001, 'L'], km: [1000, 'L'],
  m2: [1, 'A'], cm2: [1e-4, 'A'], km2: [1e6, 'A'], mm2: [1e-6, 'A'],
  m3: [1, 'V'], cm3: [1e-6, 'V'], l: [1e-3, 'V'], ml: [1e-6, 'V'],
  g: [1e-3, 'M'], kg: [1, 'M'], t: [1000, 'M'], mg: [1e-6, 'M'],
  s: [1, 'T'], ms: [1e-3, 'T'], min: [60, 'T'], h: [3600, 'T'],
  J: [1, 'E'], kJ: [1000, 'E'], cal: [4.184, 'E'], kcal: [4184, 'E'],
  W: [1, 'P'], kW: [1000, 'P'], N: [1, 'F'], kN: [1000, 'F'],
  Pa: [1, 'Pr'], kPa: [1000, 'Pr'], bar: [1e5, 'Pr'],
  'm/s': [1, 'S'], 'km/h': [1 / 3.6, 'S'], 'm/s2': [1, 'Acc'], 'm.s-2': [1, 'Acc'],
  'kg/m3': [1, 'D'], 'g/cm3': [1000, 'D'], 'g/l': [1, 'D'], 'kg/l': [1000, 'D'],
  'mol': [1, 'N'], 'mmol': [1e-3, 'N'], 'mol/l': [1000, 'C'], 'mmol/l': [1, 'C'], 'g/mol': [1, 'MM'], 'L': [1e-3, 'V'],
  V: [1, 'U'], mV: [1e-3, 'U'], kV: [1000, 'U'], A: [1, 'I'], mA: [1e-3, 'I'],
  'Ω': [1, 'R'], kΩ: [1000, 'R'],
};

export function normalizeUnit(u) {
  return String(u ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[²]/g, '2')
    .replace(/[³]/g, '3')
    .replace(/\^2/g, '2')
    .replace(/\^3/g, '3')
    .replace(/[µμ]/g, 'u')
    .replace(/ohm/i, 'Ω');
}

/** Unité connue : { factor, dim } ou null. Insensible à la casse si l'écriture est sans ambiguïté. */
export function unitInfo(u) {
  const n = normalizeUnit(u);
  if (!n) return null;
  const hit = UNITS[n] ?? Object.entries(UNITS).find(([k]) => k.toLowerCase() === n.toLowerCase())?.[1];
  return hit ? { factor: hit[0], dim: hit[1] } : null;
}

/**
 * Lit une grandeur : « 12,5 cm », « 3 × 10^8 m », « 1/4 », « 30 % ».
 * Renvoie { value, unit } ou null.
 */
export function parseQuantity(text) {
  const s = fixMinus(text).trim();
  const m = s.match(/^([-+]?\d+(?:[.,]\d+)?(?:\/\d+(?:[.,]\d+)?)?)\s*(?:(?:×|x|\*)\s*10\s*\^?\s*([-+]?\d+)|e([-+]?\d+))?\s*(.*)$/i);
  if (!m) return null;
  const base = parseValue(m[1]);
  if (base === null) return null;
  const exp = m[2] ?? m[3];
  const value = exp !== undefined ? base * 10 ** Number(exp) : base;
  const unit = m[4] ? normalizeUnit(m[4]) : '';
  return { value, unit };
}

/** Nombre de chiffres significatifs d'une saisie (« 0,0052 » → 2, « 1200 » → 2, « 1200,0 » → 5). */
export function countSigFigs(text) {
  const m = String(text ?? '').replace(',', '.').match(/\d+(?:\.\d+)?/);
  if (!m) return 0;
  let d = m[0].replace('.', '').replace(/^0+/, '');
  if (!m[0].includes('.')) d = d.replace(/0+$/, '');
  return d.length;
}

/**
 * Compare une grandeur saisie à sa valeur attendue (dans l'unité attendue).
 * Renvoie { ok, reason, value } où reason vaut null, 'format', 'missing-unit', 'wrong-unit', 'sigfigs' ou 'value'.
 */
export function quantityCheck(text, expected, opts = {}) {
  const q = parseQuantity(text);
  if (!q) return { ok: false, reason: 'format', value: null };
  const { unit: wantUnit, tolerance, decimals = 0, sigfigs, mode, requireUnit = false } = opts;
  let v = q.value;
  if (wantUnit) {
    if (!q.unit) {
      if (requireUnit) return { ok: false, reason: 'missing-unit', value: v };
    } else {
      const want = unitInfo(wantUnit);
      const got = unitInfo(q.unit);
      if (!want || !got || got.dim !== want.dim) return { ok: false, reason: 'wrong-unit', value: v };
      v = (v * got.factor) / want.factor;
    }
  }
  const rawNumber = String(text).replace(/\s*(?:×|x|\*)\s*10.*$/i, '').replace(/[^\d,.\-/]/g, ' ').trim();
  if (sigfigs && countSigFigs(rawNumber) !== sigfigs) return { ok: false, reason: 'sigfigs', value: v };
  const ok = numbersEqual(v, expected, { decimals, tolerance, mode });
  return { ok, reason: ok ? null : 'value', value: v };
}

// ---------- Contre-exemples, équations, logique ----------

/**
 * Vérifie un contre-exemple : la valeur doit satisfaire l'hypothèse et violer la conclusion.
 * Les expressions sont des comparaisons, par exemple hypothesis « x^2 > 4 », conclusion « x > 2 ».
 */
export function checkCounterexample(value, hypothesis, conclusion, name = 'x') {
  const n = parseValue(value);
  if (n === null) return { ok: false, reason: 'format' };
  try {
    const h = Boolean(evaluate(preparse(hypothesis), { [name]: n }));
    const c = Boolean(evaluate(preparse(conclusion), { [name]: n }));
    const reason = !h ? 'hypothesis' : c ? 'conclusion' : null;
    return { ok: h && !c, reason, hypothesisOk: h, conclusionOk: c };
  } catch {
    return { ok: false, reason: 'syntax' };
  }
}

/** Valeur de (membre gauche − membre droit) pour chaque solution proposée. */
export function residuals(equation, values, name = 'x') {
  const [lhs, rhs = '0'] = String(equation ?? '').split('=');
  return values.map((x) => {
    try {
      const r = evaluate(preparse(lhs), { [name]: x }) - evaluate(preparse(rhs), { [name]: x });
      return { x, residual: r };
    } catch {
      return { x, residual: NaN };
    }
  });
}

/** Vrai si deux expressions booléennes ont la même table de vérité. */
export function logicEquivalent(a, b) {
  try {
    const vars = [...new Set([...truthTable(a).vars, ...truthTable(b).vars])].sort();
    for (let m = 0; m < 2 ** vars.length; m++) {
      const env = Object.fromEntries(vars.map((v, k) => [v, (m >> (vars.length - 1 - k)) & 1]));
      if (evalBool(a, env) !== evalBool(b, env)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Premières lignes de la table où la saisie et la cible diffèrent. */
export function logicDiffRows(a, b, limit = 2) {
  const vars = [...new Set([...truthTable(a).vars, ...truthTable(b).vars])].sort();
  const rows = [];
  for (let m = 0; m < 2 ** vars.length && rows.length < limit; m++) {
    const env = Object.fromEntries(vars.map((v, k) => [v, (m >> (vars.length - 1 - k)) & 1]));
    let got;
    try {
      got = evalBool(a, env);
    } catch {
      got = null;
    }
    const want = evalBool(b, env);
    if (got !== want) rows.push({ env, got, want });
  }
  return rows;
}

// ---------- Étapes de calcul, code, complexité, diagnostic ----------

/**
 * Forme écrite d'une expression : ses termes, triés, sans espaces ni « * ». « 32+8x+8x » et « 8x+8x+32 »
 * ont la même forme ; « 16x+32 » n'en a pas. Les coefficients 1 sont explicités (x → 1x).
 */
export function formSignature(s) {
  let t = fixMinus(s).toLowerCase().replace(/\s+/g, '').replace(/[*·×]/g, '');
  t = t.replace(/\((-?\d+(?:[.,]\d+)?)\)/g, '$1');
  if (!/^[+-]/.test(t)) t = `+${t}`;
  const terms = t.match(/[+-][^+-]+/g) ?? [];
  return terms
    .map((term) => {
      const sign = term[0];
      let body = term.slice(1);
      if (/^[a-z]/.test(body)) body = `1${body}`;
      return sign + body;
    })
    .sort()
    .join('|');
}

/**
 * Une étape est juste si elle reprend la forme attendue. Pour un calcul sans variable (« 3+4 » → « 7 »),
 * on compare la valeur. Si la ligne est une égalité « 3+4 = 7 », on teste aussi chaque membre.
 * L'équivalence seule ne suffit pas : « 5x+30+5x » est égal à « 10x+30 », mais ce n'est pas la forme réduite attendue.
 */
export function stepMatches(candidate, expected) {
  const text = String(candidate ?? '');
  const parts = [text, ...(text.includes('=') ? text.split('=') : [])];
  const numeric = !/[a-zA-Z]/.test(String(expected ?? ''));
  return parts.some(
    (c) => formSignature(c) === formSignature(expected) || (numeric && equivalentExpressions(c, expected)),
  );
}

/** Parenthèses et crochets équilibrés (contrôle minimal de la syntaxe d'un code). */
export function checkBrackets(code) {
  const pairs = { ')': '(', ']': '[', '}': '{' };
  const stack = [];
  for (const ch of String(code ?? '')) {
    if ('([{'.includes(ch)) stack.push(ch);
    else if (pairs[ch] && stack.pop() !== pairs[ch]) return false;
  }
  return stack.length === 0;
}

/** Notation de complexité : O(n²), O(n^2) et O(n2) sont équivalentes. */
export function normalizeComplexity(s) {
  return String(s ?? '')
    .replace(/\s+/g, '')
    .replace(/[\^*·]/g, '')
    .replace(/²/g, '2')
    .replace(/³/g, '3')
    .replace(/Θ/g, 'theta')
    .replace(/Ω/g, 'omega')
    .replace(/θ/g, 'theta')
    .replace(/ω/g, 'omega')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Premier point où deux expressions diffèrent, avec les valeurs de variables qui le montrent. */
export function diagnoseExpression(user, expected) {
  if (String(user ?? '').includes('=') !== String(expected ?? '').includes('=')) {
    return { error: 'equation' };
  }
  const A = preparse(user);
  const B = preparse(expected);
  const ids = [...new Set([...`${A} ${B}`.matchAll(/[A-Za-z_]\w*/g)].map((m) => m[0]))];
  for (let k = 0; k < SEEDS.length; k++) {
    const scope = {};
    ids.forEach((id, i) => {
      scope[id] = SEEDS[(k + i * 3) % SEEDS.length];
    });
    let x;
    let y;
    try {
      x = evaluate(A, scope);
      y = evaluate(B, scope);
    } catch {
      return { error: 'syntax' };
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (Math.abs(x - y) > 1e-7 * (1 + Math.abs(y))) return { scope, got: x, want: y };
  }
  return null;
}
