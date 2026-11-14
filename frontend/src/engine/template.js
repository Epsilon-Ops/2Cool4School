/**
 * Questions à gabarit : les valeurs sont tirées à chaque ouverture de l'exercice,
 * et la réponse est calculée à partir de l'expression (rien n'est codé en dur).
 *
 * Exemple de gabarit :
 *   {
 *     "vars": { "a": { "min": 1, "max": 20 }, "b": { "min": 1, "max": 20 } },
 *     "prompt": "Calculer {a} × {b}",
 *     "expr": "a * b",
 *     "decimals": 0,
 *     "where": "a >= b"            // facultatif : condition que doivent respecter les valeurs
 *   }
 *
 * Variables : { min, max, step? } (entiers par défaut) ou une liste de valeurs : [2, 3, 5].
 * Expressions : + - * / ^ et parenthèses, avec × et ÷ acceptés. Comparaisons : >= <= > < == !=.
 */

const OPS = ['>=', '<=', '==', '!=', '>', '<', '+', '-', '*', '/', '^', '(', ')'];

function tokenize(src) {
  const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/\s+/g, '');
  const out = [];
  let i = 0;
  while (i < s.length) {
    const rest = s.slice(i);
    const num = rest.match(/^\d+(\.\d+)?/);
    if (num) { out.push({ t: 'num', v: Number(num[0]) }); i += num[0].length; continue; }
    const id = rest.match(/^[A-Za-z_]\w*/);
    if (id) { out.push({ t: 'id', v: id[0] }); i += id[0].length; continue; }
    const op = OPS.find((o) => rest.startsWith(o));
    if (op) { out.push({ t: 'op', v: op }); i += op.length; continue; }
    throw new Error(`Caractère inattendu dans l'expression : « ${s[i]} »`);
  }
  return out;
}

/** Évalue une expression arithmétique ou une comparaison, avec un jeu de variables. */
export function evaluate(src, scope) {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const take = () => tokens[pos++];
  const isOp = (...ops) => peek()?.t === 'op' && ops.includes(peek().v);

  function atom() {
    const tok = take();
    if (!tok) throw new Error('Expression incomplète');
    if (tok.t === 'num') return tok.v;
    if (tok.t === 'id') {
      if (!(tok.v in scope)) throw new Error(`Variable inconnue : ${tok.v}`);
      return scope[tok.v];
    }
    if (tok.v === '(') {
      const v = add();
      if (!isOp(')')) throw new Error('Parenthèse manquante');
      take();
      return v;
    }
    throw new Error(`Opérateur inattendu : ${tok.v}`);
  }
  function unary() {
    if (isOp('-')) { take(); return -unary(); }
    return power();
  }
  function power() {
    const base = atom();
    if (isOp('^')) { take(); return base ** unary(); }
    return base;
  }
  function mul() {
    let v = unary();
    while (isOp('*', '/')) {
      const op = take().v;
      const r = unary();
      v = op === '*' ? v * r : v / r;
    }
    return v;
  }
  function add() {
    let v = mul();
    while (isOp('+', '-')) {
      const op = take().v;
      const r = mul();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  function compare() {
    const l = add();
    if (isOp('>=', '<=', '==', '!=', '>', '<')) {
      const op = take().v;
      const r = add();
      return {
        '>=': l >= r, '<=': l <= r, '==': l === r, '!=': l !== r, '>': l > r, '<': l < r,
      }[op] ? 1 : 0;
    }
    return l;
  }
  const value = compare();
  if (pos !== tokens.length) throw new Error('Expression mal formée');
  return value;
}

/** Tire une valeur pour une variable selon sa spécification. */
function drawVar(spec, rng) {
  if (Array.isArray(spec)) return spec[Math.floor(rng() * spec.length)];
  const { min, max, step } = spec;
  if (step) {
    const n = Math.floor((max - min) / step);
    return min + step * Math.floor(rng() * (n + 1));
  }
  return min + Math.floor(rng() * (max - min + 1));
}

/** Arrondi à `decimals` décimales. */
const roundTo = (x, d) => Math.round(x * 10 ** d) / 10 ** d;

/** Nombre affiché (virgule française pour les décimales). */
export function formatNumber(x, decimals = 0) {
  if (decimals === 0) return String(Math.round(x));
  return x.toFixed(decimals).replace('.', ',');
}

/** Lit une réponse saisie : accepte la virgule et le point. Renvoie null si ce n'est pas un nombre. */
export function parseNumber(text) {
  const s = String(text ?? '').trim().replace(',', '.').replace(/\s/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

/** Remplace {nom} par la valeur correspondante ; les accolades inconnues sont laissées telles quelles. */
export function fillTemplate(text, scope) {
  return String(text ?? '').replace(/\{(\w+)\}/g, (m, k) => (k in scope ? String(scope[k]) : m));
}

/**
 * Tire une instance du gabarit : valeurs, énoncé, réponse et nombre exact.
 * `rng` est injectable (tests). Renvoie aussi les variables formatées pour les explications.
 */
export function instantiate(tpl, rng = Math.random) {
  const decimals = tpl.decimals ?? 0;
  let vars = {};
  let value = NaN;
  for (let attempt = 0; attempt < 200; attempt++) {
    vars = {};
    for (const [name, spec] of Object.entries(tpl.vars ?? {})) vars[name] = drawVar(spec, rng);
    if (tpl.where && !evaluate(tpl.where, vars)) continue;
    value = roundTo(evaluate(tpl.expr, vars), decimals);
    if (Number.isFinite(value)) break;
  }
  if (!Number.isFinite(value)) throw new Error('Gabarit impossible à instancier : vérifiez les intervalles et la condition');
  const shown = Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, formatNumber(v, 0)]));
  const answer = formatNumber(value, decimals);
  return {
    vars,
    value,
    decimals,
    answer,
    prompt: fillTemplate(tpl.prompt, shown),
    scope: { ...shown, answer },
  };
}

/** Mauvaises réponses plausibles autour de la bonne : valeurs proches, sans doublon. */
export function distractorsFor(value, decimals = 0, rng = Math.random, n = 3) {
  const step = 10 ** -decimals;
  const offsets = [1, -1, 2, -2, 3, -3, 10, -10].map((k) => k * step);
  const pool = [];
  for (let i = offsets.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [offsets[i], offsets[j]] = [offsets[j], offsets[i]];
  }
  const answer = formatNumber(value, decimals);
  for (const d of offsets) {
    const candidate = formatNumber(roundTo(value + d, decimals), decimals);
    if (candidate !== answer && !pool.includes(candidate)) pool.push(candidate);
    if (pool.length === n) break;
  }
  return pool;
}
