import { useState } from 'react';
import { dueQuestions } from '../engine/selection.js';
import LessonSheet from './LessonSheet.jsx';

export const MASTERED = 80; // seuil « acquise »
export const UNLOCK = 50;   // seuil de déblocage des compétences suivantes

const GAP = 112;                 // distance verticale entre deux nœuds (px)
const TOP = 84;                  // marge avant le premier nœud (px), laisse place à la bulle
const ZIGZAG = [50, 24, 50, 76]; // positions horizontales (en %) du chemin

export default function SkillTree({ subjects, bank, progress, config, setConfig, onStart, onReview }) {
  const [selectedId, setSelectedId] = useState(null);

  const mastery = (id) => progress.skills[id]?.mastery ?? 0;
  const isAcquired = (id) => mastery(id) >= MASTERED;
  const unlocked = (s) => (s.prereq ?? []).every((p) => mastery(p) >= UNLOCK);
  const statusOf = (s) => (!unlocked(s) ? 'locked' : isAcquired(s.id) ? 'acquired' : 'available');
  const countOf = (id) => bank.filter((q) => q.skill === id).length;

  const flat = subjects.flatMap((sub) =>
    sub.skills.map((s) => ({ ...s, color: sub.color, subjectName: sub.name }))
  );
  const byId = Object.fromEntries(flat.map((s) => [s.id, s]));
  const acquired = flat.filter((s) => isAcquired(s.id)).length;
  const nextId = flat.find((s) => statusOf(s) === 'available' && countOf(s.id) > 0)?.id;
  const dueCount = dueQuestions(bank, progress).length;
  const selected = selectedId ? byId[selectedId] : null;

  return (
    <>
      <section className="hero">
        <div className="hero-main">
          <span className="eyebrow">Ton parcours</span>
          <h1>
            {acquired}
            <span> / {flat.length} compétences maîtrisées</span>
          </h1>
          <div className="hud-bar">
            <div style={{ width: `${flat.length ? (acquired / flat.length) * 100 : 0}%` }} />
          </div>
        </div>
        <button className="btn btn-review" disabled={bank.length === 0} onClick={onReview}>
          Réviser
          {dueCount > 0 && <span className="count">{dueCount}</span>}
        </button>
      </section>

      <nav className="unit-nav" aria-label="Matières">
        {subjects.map((sub) => (
          <a key={sub.id} href={`#unit-${sub.id}`} style={{ '--c': sub.color }}>
            {sub.emoji} {sub.code}
          </a>
        ))}
      </nav>

      {subjects.map((sub) => {
        const doneCount = sub.skills.filter((s) => isAcquired(s.id)).length;
        return (
          <section key={sub.id} id={`unit-${sub.id}`} className="unit" style={{ '--c': sub.color }}>
            <header className="unit-head">
              <div>
                <span className="unit-code">{sub.code}</span>
                <h2>{sub.emoji} {sub.name}</h2>
                <p>{sub.description}</p>
              </div>
              <span className="unit-count">{doneCount}/{sub.skills.length}</span>
            </header>

            <Path
              sub={sub}
              mastery={mastery}
              isAcquired={isAcquired}
              statusOf={statusOf}
              nextId={nextId}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </section>
        );
      })}

      {selected && (
        <LessonSheet
          skill={selected}
          subjectName={selected.subjectName}
          status={statusOf(selected)}
          mastery={mastery(selected.id)}
          count={countOf(selected.id)}
          prereqs={(selected.prereq ?? []).map((p) => ({
            id: p,
            name: byId[p]?.name ?? p,
            ok: mastery(p) >= UNLOCK,
          }))}
          config={config}
          setConfig={setConfig}
          onClose={() => setSelectedId(null)}
          onStart={(s, cfg) => {
            setSelectedId(null);
            onStart(s, cfg);
          }}
        />
      )}
    </>
  );
}

/** Chemin en zigzag : les nœuds sont reliés dans l'ordre de la matière. */
function Path({ sub, mastery, isAcquired, statusOf, nextId, selectedId, onSelect }) {
  const n = sub.skills.length;
  const height = TOP * 2 + Math.max(0, n - 1) * GAP;
  const pts = sub.skills.map((_, i) => ({ x: ZIGZAG[i % ZIGZAG.length], y: TOP + i * GAP }));

  return (
    <div className="path" style={{ height }}>
      <svg className="path-svg" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true">
        {pts.slice(1).map((p, i) => {
          const a = pts[i];
          const d = `M ${a.x} ${a.y} C ${a.x} ${a.y + GAP / 2}, ${p.x} ${p.y - GAP / 2}, ${p.x} ${p.y}`;
          const done = isAcquired(sub.skills[i].id);
          return <path key={i} d={d} className={done ? 'seg done' : 'seg todo'} />;
        })}
      </svg>

      {sub.skills.map((s, i) => {
        const st = statusOf(s);
        const m = mastery(s.id);
        const { x, y } = pts[i];
        const isNext = s.id === nextId;
        return (
          <button
            key={s.id}
            className={`node ${st}${isNext ? ' next' : ''}${selectedId === s.id ? ' selected' : ''}`}
            style={{ left: `${x}%`, top: y, '--c': sub.color }}
            onClick={() => onSelect(s.id)}
            aria-label={`${s.name} (${st === 'locked' ? 'verrouillée' : st === 'acquired' ? 'acquise' : `${Math.round(m)} %`})`}
          >
            {st === 'available' && (
              <svg className="ring" viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="46" pathLength="100" className="ring-bg" />
                <circle cx="50" cy="50" r="46" pathLength="100" className="ring-fg" strokeDasharray={`${m} 100`} />
              </svg>
            )}
            <span className="node-icon">
              {st === 'locked' ? '🔒' : st === 'acquired' ? '★' : m > 0 ? `${Math.round(m)}%` : '▶'}
            </span>
            {isNext && <span className="bubble">{m > 0 ? 'Continuer' : 'Commencer'}</span>}
            <span className="node-label">{s.short ?? s.name}</span>
          </button>
        );
      })}
    </div>
  );
}
