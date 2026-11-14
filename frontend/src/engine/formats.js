import { shuffle } from './random.js';
import { instantiate, distractorsFor, parseNumber, fillTemplate } from './template.js';

export const FORMAT_LABELS = {
  single_choice: 'QCM',
  multi_choice: 'QCM à réponses multiples',
  true_false: 'Vrai / faux',
  flashcard: 'Flashcard',
  fill_blank: 'Texte à trous',
  ordering: 'Remettre dans l\'ordre',
  matching: 'Association',
  numeric: 'Calcul',
};

/** Ne garde que les formats dont la question possède les données nécessaires. */
export function availableFormats(q) {
  return (q.formats ?? []).filter((f) => {
    if (f === 'fill_blank') return Boolean(q.cloze);
    if (f === 'ordering') return Array.isArray(q.steps) && q.steps.length > 1;
    if (f === 'matching') return Array.isArray(q.pairs) && q.pairs.length > 1;
    if (f === 'multi_choice') return Array.isArray(q.answers) && q.answers.length >= 2;
    if (f === 'numeric') return Boolean(q.template) || parseNumber(q.answer) !== null;
    if (f === 'single_choice') {
      // Un gabarit génère ses propres mauvaises réponses.
      return Boolean(q.template) || (Array.isArray(q.distractors) && q.distractors.length >= 1);
    }
    if (f === 'true_false') {
      return Array.isArray(q.distractors) && q.distractors.length >= 1;
    }
    return true;
  });
}

/**
 * Explications remplies avec les valeurs de l'exercice (pour un gabarit, « {a} + {b} = {answer} »
 * devient « 5 + 7 = 12 »). Pour une question ordinaire, elles sont celles de la banque.
 */
function explainsOf(q, scope) {
  const f = (t) => (scope ? fillTemplate(t, scope) : t ?? '');
  return {
    simple: f(q.explanations?.simple ?? q.explanation),
    normal: f(q.explanation),
    deep: f(q.explanations?.deep ?? q.explanation),
  };
}

/** Transforme une question de la banque en exercice concret. Un gabarit est tiré à neuf à chaque appel. */
export function buildExercise(q, format) {
  const inst = q.template ? instantiate(q.template) : null;
  const scope = inst?.scope ?? null;
  const answer = inst ? inst.answer : q.answer;
  const base = {
    format,
    prompt: inst ? inst.prompt : q.prompt,
    answer,
    explain: explainsOf(q, scope),
  };

  switch (format) {
    case 'single_choice': {
      const wrong = inst
        ? distractorsFor(inst.value, inst.decimals)
        : shuffle(q.distractors).slice(0, 3);
      return { ...base, options: shuffle([answer, ...wrong]) };
    }
    case 'numeric': {
      const value = inst ? inst.value : parseNumber(q.answer);
      return { ...base, value, decimals: inst ? inst.decimals : 0 };
    }
    case 'multi_choice': {
      const wrong = shuffle(q.distractors ?? []).slice(0, 3);
      return { ...base, answers: q.answers, options: shuffle([...q.answers, ...wrong]) };
    }
    case 'true_false': {
      const isTrue = Math.random() < 0.5;
      const statement = isTrue ? q.answer : shuffle(q.distractors)[0];
      return { ...base, statement, isTrue };
    }
    case 'fill_blank':
      return { ...base, cloze: q.cloze };
    case 'ordering':
      return { ...base, steps: q.steps, shuffled: shuffle(q.steps) };
    case 'matching':
      return { ...base, pairs: q.pairs, rights: shuffle(q.pairs.map((p) => p[1])) };
    case 'flashcard':
    default:
      return base;
  }
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
