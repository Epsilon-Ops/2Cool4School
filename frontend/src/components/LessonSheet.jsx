import { useEffect } from 'react';
import Sparkline from './Sparkline.jsx';
import { LEVELS, CERT } from '../engine/mastery.js';
import { EXPLAIN_LEVELS } from '../engine/formats.js';

const COUNTS = [3, 5, 10];
const STRATEGIES = [
  ['weighted', 'Pondéré'],
  ['random', 'Aléatoire'],
  ['unseen', 'Jamais vues'],
  ['progressive', 'Croissante'],
];
const MODES = [
  ['skill', 'Normal'],
  ['reprise', 'Mes erreurs'],
];
const STATUS_LABEL = { locked: 'Verrouillée', acquired: 'Certifiée', available: 'En cours', soon: 'Bientôt' };

/** Fiche d'une compétence : maîtrise, théorie / pratique, confiance, certification, réglages. */
export default function LessonSheet({
  skill, subjectName, status, stats, prereqs, config, setConfig, guided, onClose, onStart, onAction,
}) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { mastery, theory, practice, hasPractice, events, confidence, confidenceLabel, certified, goodDays, gap, level, history, qCount, paused, staleDays, risk, trend } = stats;
  const locked = status === 'locked';
  const empty = qCount === 0;
  const label = locked ? 'Verrouillée' : empty ? 'Bientôt disponible' : events > 0 ? 'Continuer' : 'Commencer';

  const diff = theory - practice;
  const insight =
    !hasPractice ? 'Pas encore d’exercice pratique pour cette compétence.'
    : events === 0 ? 'Commence pour comparer ta théorie et ta pratique.'
    : diff >= 20 ? 'Tu retiens la théorie mais tu l’appliques moins bien : fais les exercices pratiques.'
    : diff <= -20 ? 'Tu réussis la pratique sans toujours retenir la théorie : relis les définitions.'
    : 'Théorie et pratique sont au même niveau.';

  const reqs = [
    { ok: mastery >= CERT.mastery, text: `maîtrise ≥ ${CERT.mastery} %` },
    { ok: goodDays >= CERT.goodDays, text: `réussites sur ${CERT.goodDays} jours différents (${Math.min(goodDays, CERT.goodDays)}/${CERT.goodDays})` },
    ...(hasPractice ? [{ ok: practice >= CERT.practice, text: `pratique ≥ ${CERT.practice} %` }] : []),
  ];

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
        <p className="meta">{qCount} question{qCount > 1 ? 's' : ''} dans la banque · {events} réponse{events > 1 ? 's' : ''}</p>

        <div className="mastery-head">
          <span>Maîtrise · {level.name}</span>
          <b>{mastery} %</b>
        </div>
        <div className="mastery-bar">
          <div style={{ width: `${mastery}%` }} />
        </div>
        <ol className="levels">
          {LEVELS.map((l) => (
            <li key={l.name} className={LEVELS.indexOf(l) <= LEVELS.indexOf(level) ? 'reached' : ''}>{l.name}</li>
          ))}
        </ol>

        <div className="compare">
          <div><span>Théorie</span><b>{events ? `${theory} %` : '—'}</b></div>
          <div><span>Pratique</span><b>{hasPractice && events ? `${practice} %` : '—'}</b></div>
          <div><span>Confiance</span><b>{confidenceLabel} · {confidence} %</b></div>
          <div><span>Fraîcheur</span><b>{staleDays === null ? '—' : staleDays === 0 ? 'aujourd’hui' : `${staleDays} j`}</b></div>
          <div><span>Risque d’oubli</span><b>{risk ?? '—'}</b></div>
        </div>
        <p className="insight">{insight}</p>
        {trend === 'stagnant' && <p className="insight">Ta maîtrise stagne : varie les types d’exercices ou relis le cours.</p>}
        {trend === 'fast' && <p className="insight">Acquise en moins de 3 jours : revois-la bientôt pour qu’elle reste solide.</p>}

        {gap && (
          <p className="gap-note">
            Lacune détectée : reprends les questions ratées avec le mode « Mes erreurs ».
          </p>
        )}

        <h4>{certified ? 'Certification' : 'Pour être certifiée'}</h4>
        {certified ? (
          <p className="cert-ok">✓ Certifiée le {new Date(certified).toLocaleDateString('fr-FR')}</p>
        ) : (
          <ul className="cert-req">
            {reqs.map((r) => (
              <li key={r.text} className={r.ok ? 'ok' : ''}><span>{r.ok ? '✓' : '○'}</span>{r.text}</li>
            ))}
          </ul>
        )}

        <h4>Évolution</h4>
        <Sparkline points={history} />

        {prereqs.length > 0 && (
          <>
            <h4>Prérequis{!guided && ' (conseillés)'}</h4>
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
            <div className="cfg-group">
              <span>Mode</span>
              {MODES.map(([id, text]) => (
                <button key={id} className={`pill ${config.mode === id ? 'on' : ''}`} onClick={() => setConfig({ ...config, mode: id })}>
                  {text}
                </button>
              ))}
            </div>
            <div className="cfg-group">
              <span>Explication</span>
              {EXPLAIN_LEVELS.map(([id, text]) => (
                <button key={id} className={`pill ${config.explain === id ? 'on' : ''}`} onClick={() => setConfig({ ...config, explain: id })}>
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="btn btn-primary btn-block" disabled={locked || empty || paused} onClick={() => onStart(skill, config)}>
          {label}
        </button>
        {!locked && !empty && !certified && (
          <button className="pill" disabled={paused} onClick={() => onStart(skill, { ...config, exam: true, count: 10, minutes: 15 })}>
            Examen blanc (10 questions, 15 min, sans aide)
          </button>
        )}
        {!empty && (
          <div className="skill-actions">
            <button className="pill" onClick={() => onAction('pause')}>{paused ? 'Reprendre' : 'Mettre en pause'}</button>
            {!certified && <button className="pill" onClick={() => onAction('acquire')}>Marquer comme acquise</button>}
            <button className="pill" onClick={() => onAction('reset')}>Réinitialiser</button>
          </div>
        )}
      </div>
    </div>
  );
}
