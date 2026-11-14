import { useEffect, useRef, useState } from 'react';
import Activity from './Activity.jsx';
import Mascot from './Mascot.jsx';
import { pickQuestions, dueQuestions } from '../engine/selection.js';
import { availableFormats, buildExercise, FORMAT_LABELS, explanationFor } from '../engine/formats.js';
import { xpForAnswer } from '../engine/mastery.js';

function makeExercise(q) {
  if (!q) return null;
  const formats = availableFormats(q);
  const format = formats[Math.floor(Math.random() * formats.length)];
  return buildExercise(q, format);
}

/** Texte de la bonne réponse, selon le format affiché. */
function revealOf(ex, q) {
  switch (ex.format) {
    case 'true_false': return ex.isTrue ? 'Vrai' : 'Faux';
    case 'ordering': return ex.steps.join(' → ');
    case 'matching': return ex.pairs.map(([l, r]) => `${l} = ${r}`).join(' · ');
    case 'multi_choice': return ex.answers.join(' · ');
    default: return q.answer;
  }
}

const EMPTY_MESSAGE = {
  reprise: 'Aucune erreur à reprendre pour l’instant, bravo !',
  assimilation: 'Aucune lacune détectée pour le moment.',
};

/**
 * Session de révision.
 * - Une mauvaise réponse remet la question en fin de session (une seule fois).
 * - Le bilan compte les premières tentatives uniquement.
 * skill = { id, name, color, review?, mix? } ; review pour les révisions dues, mix pour le mélange.
 */
export default function Session({ skill, bank, config, progress, stats, onAnswer, onExit }) {
  const [queue, setQueue] = useState(() => {
    const isGlobal = Boolean(skill.review || skill.mix);
    const due = skill.review ? dueQuestions(bank, progress) : [];
    const base = skill.questionIds ? bank.filter((q) => skill.questionIds.includes(q.id)) : bank;
    const pool = (skill.review && due.length ? due : base).filter(
      (q) => availableFormats(q).length > 0 && !progress.skills[q.skill]?.paused,
    );
    return pickQuestions(pool, {
      skill: isGlobal ? undefined : skill.id,
      count: config.count,
      strategy: config.strategy,
      progress,
      mode: config.mode ?? 'skill',
      gapIds: new Set(stats?.gaps ?? []),
    });
  });
  const [idx, setIdx] = useState(0);
  const [ex, setEx] = useState(() => makeExercise(queue[0]));
  const [feedback, setFeedback] = useState(null);
  const [results, setResults] = useState([]); // premières tentatives : { ok }
  const [xp, setXp] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [finished, setFinished] = useState(false);
  const [log, setLog] = useState([]); // correction de l'examen : { q, ex, ok }
  const [left, setLeft] = useState(config.exam && config.minutes ? config.minutes * 60 : null); // secondes restantes
  const firstSeen = useRef(new Set());
  const retried = useRef(new Set());

  const current = queue[idx];

  function submit(ok, quality) {
    if (feedback || !current) return;
    // XP calculé avant la réponse, comme dans la progression : même montant affiché et enregistré.
    const gained = xpForAnswer(current, ok, progress.qlog?.[current.id] ?? []);
    onAnswer(current, ok, quality ?? (ok ? 4 : 1), ex.format);
    if (config.exam) {
      // Examen : ni retour ni explication pendant l'épreuve, la correction vient à la fin.
      setLog((l) => [...l, { q: current, ex, ok }]);
      if (!firstSeen.current.has(current.id)) {
        firstSeen.current.add(current.id);
        setResults((r) => [...r, { ok }]);
      }
      setXp((x) => x + gained);
      return next();
    }
    setFeedback({ ok });

    if (!firstSeen.current.has(current.id)) {
      firstSeen.current.add(current.id);
      setResults((r) => [...r, { ok }]);
    }
    setXp((x) => x + gained);
    if (ok) {
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      setBestCombo((b) => Math.max(b, nextCombo));
    } else {
      setCombo(0);
      if (!retried.current.has(current.id)) {
        retried.current.add(current.id);
        setQueue((q) => [...q, current]);
      }
    }
  }

  function next() {
    if (idx + 1 >= queue.length) {
      setFinished(true);
      return;
    }
    setIdx(idx + 1);
    setEx(makeExercise(queue[idx + 1]));
    setFeedback(null);
  }

  // Entrée = continuer, une fois le retour affiché
  useEffect(() => {
    if (!feedback) return undefined;
    // Seulement si rien n'a le focus : évite le double déclenchement avec le bouton
    const onKey = (e) => {
      if (e.key === 'Enter' && e.target.tagName === 'BODY') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Chronomètre de l'examen : à zéro, l'épreuve se termine.
  useEffect(() => {
    if (left === null || finished) return undefined;
    if (left <= 0) {
      setFinished(true);
      return undefined;
    }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left, finished]);

  if (queue.length === 0) {
    return (
      <div className="session">
        <div className="summary">
          <Mascot mood="idle" size={96} />
          <p>{EMPTY_MESSAGE[config.mode] ?? 'Pas encore de questions pour cette sélection.'}</p>
          <button className="check" onClick={onExit}>Retour</button>
        </div>
      </div>
    );
  }

  if (finished) {
    const correct = results.filter((r) => r.ok).length;
    const pct = results.length ? Math.round((correct / results.length) * 100) : 0;
    const title = config.exam
      ? (left !== null && left <= 0 ? 'Temps écoulé' : 'Examen terminé')
      : pct >= 90 ? 'Parfait !' : pct >= 60 ? 'Bien joué !' : 'Continue, ça va rentrer !';
    return (
      <div className="session">
        <div className="summary">
          <Mascot mood={pct >= 60 ? 'happy' : 'sad'} size={120} />
          <h2>{title}</h2>
          <div className="stat-grid">
            <div className="stat"><b>{pct}%</b><span>précision</span></div>
            <div className="stat"><b>+{xp}</b><span>XP</span></div>
            <div className="stat"><b>{bestCombo}</b><span>meilleure série</span></div>
          </div>
          <p className="muted">{correct} bonne{correct > 1 ? 's' : ''} réponse{correct > 1 ? 's' : ''} sur {results.length}</p>
          {config.exam && (
            <>
              <h3>Correction</h3>
              <ol className="correction">
                {log.map((l, i) => (
                  <li key={i} className={l.ok ? 'good' : 'bad'}>
                    <b>{l.ok ? '✓' : '✗'} {l.q.prompt}</b>
                    <span>Réponse : {revealOf(l.ex, l.q)}</span>
                    <p>{explanationFor(l.q, config.explain)}</p>
                  </li>
                ))}
              </ol>
            </>
          )}
          <button className="btn btn-primary btn-block" onClick={onExit}>Retour</button>
        </div>
      </div>
    );
  }

  const pct = (idx / queue.length) * 100;
  const tag = config.mode === 'spontaneous' ? '' : skill.name;

  return (
    <div className={`session ${feedback ? 'has-feedback' : ''}`} style={{ '--c': skill.color }}>
      <div className="session-top">
        <button className="close" onClick={onExit} aria-label="Quitter">✕</button>
        <div className="bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <div style={{ width: `${pct}%` }} />
        </div>
        {combo >= 2 && <span key={combo} className="combo">🔥 {combo}</span>}
        {left !== null && (
          <span className="timer">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>
        )}
      </div>

      {ex && (
        <div className="exercise-card" key={idx}>
          <span className="fmt-tag">{FORMAT_LABELS[ex.format]}{tag && ` · ${tag}`}</span>
          <Activity ex={ex} done={!!feedback} onResult={submit} />
        </div>
      )}

      {feedback && (
        <div className={`feedback ${feedback.ok ? 'good' : 'bad'}`} role="status">
          <div className="feedback-inner">
            <Mascot mood={feedback.ok ? 'happy' : 'sad'} size={68} />
            <div className="txt">
              <strong>{feedback.ok ? 'Bravo !' : 'Pas tout à fait'}</strong>
              <p>{explanationFor(current, config.explain)}</p>
              {!feedback.ok && <p className="answer"><b>Réponse :</b> {revealOf(ex, current)}</p>}
            </div>
            <button className="continue" onClick={next}>Continuer</button>
          </div>
        </div>
      )}
    </div>
  );
}
