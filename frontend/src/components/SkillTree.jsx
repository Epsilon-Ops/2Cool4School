import { useState } from 'react';
import { dueQuestions } from '../engine/selection.js';
import { UNLOCK } from '../engine/mastery.js';
import { DOMAIN_REQUIREMENTS } from '../engine/gamification.js';
import LessonSheet from './LessonSheet.jsx';

const GAP = 112;                 // distance verticale entre deux nœuds (px)
const TOP = 84;                  // marge avant le premier nœud (px)
const ZIGZAG = [50, 24, 50, 76]; // positions horizontales (en %) du chemin

const EMPTY = { mastery: 0, qCount: 0, certified: null, gap: false, events: 0 };

import categories from '../data/utils/categories.json';

export default function SkillTree({
  subjects, bank, stats, progress, config, setConfig, onStart, onReview, onMix,
  guided, onToggleGuided, focusId, onSkillAction, isDomainOpen = () => true,
}) {
  const [selectedId, setSelectedId] = useState(focusId ?? null);

  const st = (id) => stats.byId[id] ?? EMPTY;
  // Une compétence sans question ne peut pas être travaillée : elle ne bloque jamais la suite.
  const isPlayable = (id) => st(id).qCount > 0;

  const unlocked = (s) =>
    !guided ||
    ((s.prereq ?? []).every((p) => !isPlayable(p) || st(p).mastery >= UNLOCK) &&
      (s.prereqAny ?? []).every((group) => group.some((p) => !isPlayable(p) || st(p).mastery >= UNLOCK)));

  // Domaine verrouillé (parcours guidé) : toutes ses compétences restent fermées.
  const domainLocked = (subjectId) => guided && !isDomainOpen(subjectId);

  const statusOf = (s) => {
    if (!isPlayable(s.id)) return 'soon';
    if (st(s.id).certified) return 'acquired';
    if (st(s.id).paused) return 'paused';
    if (domainLocked(s.subjectId)) return 'locked';
    if (!unlocked(s)) return 'locked';
    return 'available';
  };

  const flat = subjects.flatMap((sub) => sub.skills.map((s) => ({ ...s, subjectId: sub.id, color: sub.color, subjectName: sub.name })));
  const byIdFlat = Object.fromEntries(flat.map((s) => [s.id, s]));
  const playable = flat.filter((s) => isPlayable(s.id));
  const certifiedCount = playable.filter((s) => st(s.id).certified).length;
  const nextId = flat.find((s) => statusOf(s) === 'available')?.id;

  // Marqueur « Commencer / Continuer » : une fois par matière, sur la première compétence disponible
  // dont la maîtrise est sous 80 %. Dès qu'elle atteint 80 %, le marqueur passe à la suivante.
  const NEXT_MASTERY = 80;
  const nextBySub = {};
  for (const s of flat) {
    if (nextBySub[s.subjectId]) continue;
    if (statusOf(s) === 'available' && st(s.id).mastery < NEXT_MASTERY) nextBySub[s.subjectId] = s.id;
  }
  const dueCount = dueQuestions(bank, progress).length;
  const selected = selectedId ? byIdFlat[selectedId] : null;
  const gapCount = stats.gaps.length;

  const catOf = (sub) => sub.category ?? 'scolaire';
  const catOfSubject = Object.fromEntries(subjects.map((sub) => [sub.id, catOf(sub)]));

  // Matières dépliées : par défaut celle qui contient la compétence ciblée ou la prochaine.
  const [openIds, setOpenIds] = useState(() => {
    const target = focusId ?? nextId;
    const first = subjects.find((sub) => sub.skills.some((s) => s.id === target)) ?? subjects[0];
    return new Set(first ? [first.id] : []);
  });
  // Catégories dépliées : « Matières scolaires » par défaut, plus celle qui contient la cible.
  const [openCats, setOpenCats] = useState(() => {
    const target = focusId ?? nextId;
    const first = subjects.find((sub) => sub.skills.some((s) => s.id === target));
    return new Set(['scolaire', ...(first ? [catOf(first)] : [])]);
  });
  const toggleUnit = (id) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleCat = (id) =>
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const openCat = (id) => setOpenCats((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  const openUnit = (id) => setOpenIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));

  const renderUnit = (sub) => {
    const isOpen = openIds.has(sub.id);
    const subPlayable = sub.skills.filter((s) => isPlayable(s.id));
    const doneCount = subPlayable.filter((s) => st(s.id).certified).length;
    const bodyId = `unit-body-${sub.id}`;
    const locked = domainLocked(sub.id);
    const required = DOMAIN_REQUIREMENTS[sub.id] ?? 0;
    const certCount = flat.filter((s) => st(s.id).certified).length;
    return (
      <section
        key={sub.id}
        id={`unit-${sub.id}`}
        className={`unit${isOpen ? '' : ' collapsed'}${locked ? ' is-locked' : ''}`}
        style={{ '--c': sub.color }}
      >
        <header className="unit-head" onClick={() => toggleUnit(sub.id)}>
          <div>
            <span className="unit-code">{sub.code}</span>
            <h2>
              <button type="button" className="unit-toggle" aria-expanded={isOpen} aria-controls={bodyId}>
                <span>{locked ? '🔒 ' : ''}{sub.emoji} {sub.name}</span>
                <span className="chev" aria-hidden="true">▾</span>
              </button>
            </h2>
            <p>{sub.description}</p>
            {locked && (
              <p className="domain-note">
                Se débloque après {required} certification{required > 1 ? 's' : ''} ({Math.min(certCount, required)}/{required})
              </p>
            )}
          </div>
          {subPlayable.length > 0 ? <span className="unit-count">{doneCount}/{subPlayable.length}</span> : null}
        </header>

        <div id={bodyId} hidden={!isOpen}>
          {subPlayable.length > 0 ? (
            <Path sub={sub} st={st} statusOf={statusOf} nextId={nextBySub[sub.id]} selectedId={selectedId} onSelect={setSelectedId} />
          ) : (
            <p className="muted soon-note">Bientôt disponible : les exercices de cette matière arrivent.</p>
          )}
        </div>
      </section>
    );
  };

  return (
    <>
      <section className="hero">
        <div className="hero-main">
          <span className="eyebrow">Ton parcours</span>
          <h1>
            {certifiedCount}
            <span> / {playable.length} compétences certifiées</span>
          </h1>
          <div className="hud-bar">
            <div style={{ width: `${playable.length ? (certifiedCount / playable.length) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="hero-actions">
          <button className="btn btn-review" disabled={bank.length === 0} onClick={onReview}>
            Réviser
            {dueCount > 0 && <span className="count">{dueCount}</span>}
          </button>
          <button className="pill toggle" aria-pressed={guided} onClick={onToggleGuided}>
            {guided ? 'Parcours guidé' : 'Apprentissage libre'}
          </button>
        </div>
      </section>

      <div className="mix-row" role="group" aria-label="Exercices mélangés">
        <span>Mélange</span>
        <button className="pill" onClick={() => onMix('mix')}>Aléatoire</button>
        <button className="pill" onClick={() => onMix('reprise')}>Mes erreurs</button>
        <button className="pill" onClick={() => onMix('spontaneous')}>Spontané</button>
        <button className="pill" disabled={gapCount === 0} onClick={() => onMix('assimilation')}>
          Lacunes{gapCount > 0 ? ` (${gapCount})` : ''}
        </button>
      </div>

      <nav className="unit-nav" aria-label="Catégories">
        {categories.map((cat) => (
          <a key={cat.id} href={`#cat-${cat.id}`} style={{ '--c': cat.color }} onClick={() => openCat(cat.id)}>
            {cat.emoji} {cat.label}
          </a>
        ))}
      </nav>

      {categories.map((cat) => {
        const list = subjects.filter((sub) => catOf(sub) === cat.id);
        if (!list.length) return null;
        const isCatOpen = openCats.has(cat.id);
        const withContent = list.filter((sub) => sub.skills.some((s) => isPlayable(s.id))).length;
        return (
          <section key={cat.id} id={`cat-${cat.id}`} className={`cat-group${isCatOpen ? '' : ' collapsed'}`} style={{ '--c': cat.color }}>
            <h2 className="cat-title">
              <button
                type="button"
                className="cat-toggle"
                aria-expanded={isCatOpen}
                aria-controls={`cat-body-${cat.id}`}
                onClick={() => toggleCat(cat.id)}
              >
                <span>{cat.emoji} {cat.label}</span>
                <span className="cat-count">{withContent}/{list.length} avec contenu</span>
                <span className="chev" aria-hidden="true">▾</span>
              </button>
            </h2>
            <div id={`cat-body-${cat.id}`} className="cat-body" hidden={!isCatOpen}>
              {list.map((sub) => renderUnit(sub))}
            </div>
          </section>
        );
      })}

      {selected && (
        <LessonSheet
          skill={selected}
          subjectName={selected.subjectName}
          status={statusOf(selected)}
          stats={st(selected.id)}
          guided={guided}
          prereqs={(selected.prereq ?? []).map((p) => ({
            id: p,
            name: byIdFlat[p]?.name ?? p,
            ok: st(p).mastery >= UNLOCK,
            soon: !isPlayable(p),
          }))}
          config={config}
          setConfig={setConfig}
          onAction={(kind) => onSkillAction(kind, selected.id)}
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
function Path({ sub, st, statusOf, nextId, selectedId, onSelect }) {
  const n = sub.skills.length;
  const height = TOP * 2 + Math.max(0, n - 1) * GAP;
  const pts = sub.skills.map((_, i) => ({ x: ZIGZAG[i % ZIGZAG.length], y: TOP + i * GAP }));

  return (
    <div className="path" style={{ height }}>
      <svg className="path-svg" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden="true">
        {pts.slice(1).map((p, i) => {
          const a = pts[i];
          const d = `M ${a.x} ${a.y} C ${a.x} ${a.y + GAP / 2}, ${p.x} ${p.y - GAP / 2}, ${p.x} ${p.y}`;
          const done = Boolean(st(sub.skills[i].id).certified);
          return <path key={i} d={d} className={done ? 'seg done' : 'seg todo'} />;
        })}
      </svg>

      {sub.skills.map((s, i) => {
        const status = statusOf(s);
        const info = st(s.id);
        const m = info.mastery;
        const { x, y } = pts[i];
        const isNext = s.id === nextId;
        const gap = info.gap;
        const aria =
          status === 'locked' ? 'verrouillée'
          : status === 'acquired' ? 'certifiée'
          : status === 'soon' ? 'bientôt disponible'
          : `${m} %${gap ? ', lacune' : ''}`;
        return (
          <button
            key={s.id}
            className={`node ${status}${isNext ? ' next' : ''}${selectedId === s.id ? ' selected' : ''}${gap ? ' gap' : ''}`}
            style={{ left: `${x}%`, top: y, '--c': sub.color }}
            onClick={() => onSelect(s.id)}
            aria-label={`${s.name} (${aria})`}
          >
            {status === 'available' && (
              <svg className="ring" viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="46" pathLength="100" className="ring-bg" />
                <circle cx="50" cy="50" r="46" pathLength="100" className="ring-fg" strokeDasharray={`${m} 100`} />
              </svg>
            )}
            <span className="node-icon">
              {status === 'paused' ? '⏸' : status === 'locked' ? '🔒'
                : status === 'acquired' ? '★'
                : status === 'soon' ? '…'
                : m > 0 ? `${m}%` : '▶'}
            </span>
            {isNext && <span className="bubble">{m > 0 ? 'Continuer' : 'Commencer'}</span>}
            <span className="node-label">{s.short ?? s.name}</span>
          </button>
        );
      })}
    </div>
  );
}
