import { shuffle } from './random.js';

export const FORMAT_LABELS = {
  single_choice: 'QCM',
  true_false: 'Vrai / faux',
  flashcard: 'Flashcard',
  fill_blank: 'Texte à trous',
  ordering: 'Remettre dans l\'ordre',
  matching: 'Association',
};

/** Ne garde que les formats dont la question possède les données nécessaires. */
export function availableFormats(q) {
  return (q.formats ?? []).filter((f) => {
    if (f === 'fill_blank') return Boolean(q.cloze);
    if (f === 'ordering') return Array.isArray(q.steps) && q.steps.length > 1;
    if (f === 'matching') return Array.isArray(q.pairs) && q.pairs.length > 1;
    if (f === 'single_choice' || f === 'true_false') {
      return Array.isArray(q.distractors) && q.distractors.length >= 1;
    }
    return true;
  });
}

/** Transforme une question de la banque en exercice concret. */
export function buildExercise(q, format) {
  const base = { format, prompt: q.prompt, answer: q.answer, explanation: q.explanation };

  switch (format) {
    case 'single_choice': {
      const wrong = shuffle(q.distractors).slice(0, 3);
      return { ...base, options: shuffle([q.answer, ...wrong]) };
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
