import { useEffect } from 'react';

const COUNTS = [3, 5, 10];
const STRATEGIES = [
  ['weighted', 'Pondéré'],
  ['random', 'Aléatoire'],
  ['unseen', 'Jamais vues'],
  ['progressive', 'Croissante'],
];
const LEVELS = [
  ['Découverte', 0],
  ['Compréhension', 25],
  ['Application', 50],
  ['Maîtrise', 80],
];
const STATUS_LABEL = { locked: 'Verrouillée', acquired: 'Acquise', available: 'Disponible', soon: 'Bientôt' };

/** Fiche d'une compétence : détail, prérequis, réglages et bouton de départ. */
export default function LessonSheet({
  skill, subjectName, status, mastery, count, prereqs, config, setConfig, onClose, onStart,
}) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const locked = status === 'locked';
  const empty = count === 0;
  const label = locked ? 'Verrouillée' : empty ? 'Bientôt disponible' : mastery > 0 ? 'Continuer' : 'Commencer';

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="sheet"
        style={{ '--c': skill.color }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="close" onClick={onClose} aria-label="Fermer">✕</button>
        <span className={`badge ${status}`}>{STATUS_LABEL[status]}</span>
        <span className="eyebrow">{subjectName}</span>
        <h3 id="sheet-title">{skill.name}</h3>
        <p className="desc">{skill.description}</p>
        <p className="meta">{count} question{count > 1 ? 's' : ''} dans la banque</p>

        <div className="mastery-head">
          <span>Maîtrise</span>
          <b>{Math.round(mastery)} %</b>
        </div>
        <div className="mastery-bar">
          <div style={{ width: `${mastery}%` }} />
        </div>
        <ol className="levels">
          {LEVELS.map(([name, t]) => (
            <li key={name} className={mastery >= t ? 'reached' : ''}>{name}</li>
          ))}
        </ol>

        {prereqs.length > 0 && (
          <>
            <h4>Prérequis</h4>
            <ul className="prereqs">
              {prereqs.map((p) => (
                <li key={p.id} className={p.soon ? 'soon' : p.ok ? 'ok' : 'todo'}>
                  <span>{p.soon ? '…' : p.ok ? '✓' : '○'}</span>
                  {p.name}{p.soon && <em> (bientôt)</em>}
                </li>
              ))}
            </ul>
          </>
        )}

        {!locked && !empty && (
          <div className="cfg">
            <div className="cfg-group">
              <span>Questions</span>
              {COUNTS.map((n) => (
                <button key={n} className={`pill ${config.count === n ? 'on' : ''}`} onClick={() => setConfig({ ...config, count: n })}>
                  {n}
                </button>
              ))}
            </div>
            <div className="cfg-group">
              <span>Ordre</span>
              {STRATEGIES.map(([id, text]) => (
                <button key={id} className={`pill ${config.strategy === id ? 'on' : ''}`} onClick={() => setConfig({ ...config, strategy: id })}>
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="btn btn-primary btn-block" disabled={locked || empty} onClick={() => onStart(skill, config)}>
          {label}
        </button>
      </div>
    </div>
  );
}
