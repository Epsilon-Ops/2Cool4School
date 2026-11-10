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

  // Nombre de questions par compétence, calculé une seule fois.
  const countById = {};
  for (const q of bank) countById[q.skill] = (countById[q.skill] ?? 0) + 1;
  const countOf = (id) => countById[id] ?? 0;
  // Une compétence sans question ne peut pas être travaillée : elle ne bloque jamais la suite.
  const isPlayable = (id) => countOf(id) > 0;

  const unlocked = (s) => (s.prereq ?? []).every((p) => !isPlayable(p) || mastery(p) >= UNLOCK);
  const statusOf = (s) => {
    if (!isPlayable(s.id)) return 'soon';
    if (!unlocked(s)) return 'locked';
    return isAcquired(s.id) ? 'acquired' : 'available';
  };

  const flat = subjects.flatMap((sub) =>
    sub.skills.map((s) => ({ ...s, color: sub.color, subjectName: sub.name }))
  );
  const byId = Object.fromEntries(flat.map((s) => [s.id, s]));
  const playable = flat.filter((s) => isPlayable(s.id));
  const acquired = playable.filter((s) => isAcquired(s.id)).length;
  const nextId = flat.find((s) => statusOf(s) === 'available')?.id;
  const dueCount = dueQuestions(bank, progress).length;
  const selected = selectedId ? byId[selectedId] : null;

  // Matières dépliées : par défaut, seulement celle qui contient la prochaine compétence.
  const [openIds, setOpenIds] = useState(() => {
    const first = subjects.find((sub) => sub.skills.some((s) => s.id === nextId)) ?? subjects[0];
    return new Set(first ? [first.id] : []);
  });
  const toggleUnit = (id) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const openUnit = (id) => setOpenIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));

  return (
    <>
      <section className="hero">
        <div className="hero-main">
          <span className="eyebrow">Ton parcours</span>
          <h1>
            {acquired}
            <span> / {playable.length} compétences maîtrisées</span>
          </h1>
          <div className="hud-bar">
            <div style={{ width: `${playable.length ? (acquired / playable.length) * 100 : 0}%` }} />
          </div>
        </div>
        <button className="btn btn-review" disabled={bank.length === 0} onClick={onReview}>
          Réviser
          {dueCount > 0 && <span className="count">{dueCount}</span>}
        </button>
      </section>

      <nav className="unit-nav" aria-label="Matières">
        {subjects.map((sub) => (
          <a key={sub.id} href={`#unit-${sub.id}`} style={{ '--c': sub.color }} onClick={() => openUnit(sub.id)}>
            {sub.emoji} {sub.code}
          </a>
        ))}
      </nav>

      {subjects.map((sub) => {
        const isOpen = openIds.has(sub.id);
        const subPlayable = sub.skills.filter((s) => isPlayable(s.id));
        const doneCount = subPlayable.filter((s) => isAcquired(s.id)).length;
        const bodyId = `unit-body-${sub.id}`;
        return (
          <section
            key={sub.id}
            id={`unit-${sub.id}`}
            className={`unit${isOpen ? '' : ' collapsed'}`}
            style={{ '--c': sub.color }}
          >
            <header className="unit-head" onClick={() => toggleUnit(sub.id)}>
              <div>
                <span className="unit-code">{sub.code}</span>
                <h2>
                  <button
                    type="button"
                    className="unit-toggle"
                    aria-expanded={isOpen}
                    aria-controls={bodyId}
                  >
                    <span>{sub.emoji} {sub.name}</span>
                    <span className="chev" aria-hidden="true">▾</span>
                  </button>
                </h2>
                <p>{sub.description}</p>
              </div>
              <span className="unit-count">{doneCount}/{subPlayable.length}</span>
            </header>

            <div id={bodyId} hidden={!isOpen}>
              <Path
                sub={sub}
                mastery={mastery}
                isAcquired={isAcquired}
                statusOf={statusOf}
                nextId={nextId}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
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
            soon: !isPlayable(p),
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
        const aria =
          st === 'locked' ? 'verrouillée'
          : st === 'acquired' ? 'acquise'
          : st === 'soon' ? 'bientôt disponible'
          : `${Math.round(m)} %`;
        return (
          <button
            key={s.id}
            className={`node ${st}${isNext ? ' next' : ''}${selectedId === s.id ? ' selected' : ''}`}
            style={{ left: `${x}%`, top: y, '--c': sub.color }}
            onClick={() => onSelect(s.id)}
            aria-label={`${s.name} (${aria})`}
          >
            {st === 'available' && (
              <svg className="ring" viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="46" pathLength="100" className="ring-bg" />
                <circle cx="50" cy="50" r="46" pathLength="100" className="ring-fg" strokeDasharray={`${m} 100`} />
              </svg>
            )}
            <span className="node-icon">
              {st === 'locked' ? '🔒'
                : st === 'acquired' ? '★'
                : st === 'soon' ? '…'
                : m > 0 ? `${Math.round(m)}%` : '▶'}
            </span>
            {isNext && <span className="bubble">{m > 0 ? 'Continuer' : 'Commencer'}</span>}
            <span className="node-label">{s.short ?? s.name}</span>
          </button>
        );
      })}
    </div>
  );
}
