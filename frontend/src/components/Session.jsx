import { useState } from 'react';
import Activity from './Activity.jsx';
import React from 'react';
import Mascot from './Mascot.jsx';
import { pickQuestions } from '../engine/selection.js';
import { availableFormats, buildExercise, FORMAT_LABELS } from '../engine/formats.js';

function makeExercise(q) {
  if (!q) return null;
  const formats = availableFormats(q);
  if (formats.length === 0) return null;
  const format = formats[Math.floor(Math.random() * formats.length)];
  return buildExercise(q, format);
}

export default function Session({ skill, bank, config, progress, onAnswer, onExit }) {
  const [questions] = useState(() =>
    pickQuestions(bank, { skill: skill.id, count: config.count, strategy: config.strategy, progress })
  );
  const [i, setI] = useState(0);
  const [ex, setEx] = useState(() => makeExercise(questions[0]));
  const [feedback, setFeedback] = useState(null);
  const [score, setScore] = useState({ correct: 0, xp: 0 });
  const [finished, setFinished] = useState(false);

  if (questions.length === 0) {
    return (
      <div className="session">
        <div className="summary">
          <p>Pas encore de questions pour cette compétence.</p>
          <button className="check" onClick={onExit}>Retour</button>
        </div>
      </div>
    );
  }

  const current = questions[i];

  function submit(ok, quality) {
    if (feedback) return;
    setFeedback({ ok });
    onAnswer(current, ok, quality ?? (ok ? 4 : 1));
    setScore((s) => ({
      correct: s.correct + (ok ? 1 : 0),
      xp: s.xp + (ok ? 10 + current.difficulty * 5 : 0),
    }));
  }

  function next() {
    if (i + 1 >= questions.length) {
      setFinished(true);
      return;
    }
    setI(i + 1);
    setEx(makeExercise(questions[i + 1]));
    setFeedback(null);
  }

  if (finished) {
    return (
      <div className="session">
        <div className="summary">
          <Mascot mood="happy" size={96} />
          <h2>Session terminée !</h2>
          <div className="big">{score.correct}/{questions.length}</div>
          <p>+{score.xp} XP</p>
          <button className="check" onClick={onExit}>Retour à l'arbre</button>
        </div>
      </div>
    );
  }

  const reveal =
    ex?.format === 'single_choice' ? current.answer : ex?.format === 'true_false' ? (ex.isTrue ? 'Vrai' : 'Faux') : null;

  return (
    <div className="session">
      <div className="session-top">
        <button className="close" onClick={onExit} aria-label="Quitter">✕</button>
        <div className="bar">
          <div style={{ width: `${(i / questions.length) * 100}%` }} />
        </div>
      </div>

      {ex && (
        <div className="exercise-card" key={i}>
          <span className="fmt-tag">
            {FORMAT_LABELS[ex.format]} · {skill.name}
          </span>
          <Activity ex={ex} done={!!feedback} onResult={submit} />
        </div>
      )}

      {feedback && (
        <div className={`feedback ${feedback.ok ? 'good' : 'bad'}`}>
          <div className="feedback-inner">
            <Mascot mood={feedback.ok ? 'happy' : 'sad'} size={64} />
            <div className="txt">
              <strong>{feedback.ok ? 'Bravo !' : 'Pas tout à fait'}</strong>
              <p>{current.explanation}</p>
              {!feedback.ok && reveal && <p><strong>Réponse : </strong>{reveal}</p>}
            </div>
            <button className="continue" onClick={next}>Continuer</button>
          </div>
        </div>
      )}
    </div>
  );
}
