
import { useState } from 'react';

const VIEW_W = 900;
const VIEW_H = 650;
const R = 36;
const ARC_R = R - 7;
const ARC_C = 2 * Math.PI * ARC_R;

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

function edgePath(a, b) {
  const dx = (b.x - a.x) * 0.5;

  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

export default function SkillTree({
  subjects,
  bank,
  progress,
  config,
  setConfig,
  onStart,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [expandedSubjects, setExpandedSubjects] = useState({});
  const [navigationMode, setNavigationMode] = useState('both');

  const mastery = (id) => progress.skills[id]?.mastery ?? 0;

  const isAcquired = (id) => mastery(id) >= 80;

  const isUnlocked = (s) =>
    (s.prereq ?? []).every((p) => mastery(p) >= 50);

  const statusOf = (s) =>
    !isUnlocked(s)
      ? 'locked'
      : isAcquired(s.id)
        ? 'acquired'
        : 'available';

  const countOf = (id) =>
    bank.filter((q) => q.skill === id).length;

  const allSkills = {};

  subjects.forEach((sub) =>
    sub.skills.forEach((s) => {
      allSkills[s.id] = {
        ...s,
        color: sub.color,
        subjectId: sub.id,
      };
    })
  );

  const ids = Object.keys(allSkills);

  const acquiredCount = ids.filter(isAcquired).length;

  const selected = selectedId
    ? allSkills[selectedId]
    : null;

  const toggleSubject = (id) => {
    setExpandedSubjects((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <>
      <section className="hud">
        <div className="hud-main">
          <div>
            <span className="eyebrow">
              Arbre des compétences
            </span>

            <h1 className="hud-title">
              {acquiredCount}
              <span> / {ids.length} maîtrisées</span>
            </h1>
          </div>

          <div className="hud-bar">
            <div
              style={{
                width: `${ids.length ? (acquiredCount / ids.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        <div className="hud-config">
          <div className="cfg-group">
            <span>Questions</span>

            {COUNTS.map((n) => (
              <button
                key={n}
                className={`pill ${config.count === n ? 'on' : ''}`}
                onClick={() =>
                  setConfig({ ...config, count: n })
                }
              >
                {n}
              </button>
            ))}
          </div>

          <div className="cfg-group">
            <span>Ordre</span>

            {STRATEGIES.map(([id, label]) => (
              <button
                key={id}
                className={`pill ${config.strategy === id ? 'on' : ''}`}
                onClick={() =>
                  setConfig({ ...config, strategy: id })
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="tree-navigation">
        <button
          className={navigationMode === 'both' ? 'active' : ''}
          onClick={() => setNavigationMode('both')}
        >
          Vue complète
        </button>

        <button
          className={navigationMode === 'subjects' ? 'active' : ''}
          onClick={() => setNavigationMode('subjects')}
        >
          Matières
        </button>

        <button
          className={navigationMode === 'skills' ? 'active' : ''}
          onClick={() => setNavigationMode('skills')}
        >
          Compétences
        </button>
      </div>

      <div className="tree-layout">
        <div className="maps">
          {subjects.map((sub) => {
            const expanded = expandedSubjects[sub.id] ?? true;

            if (navigationMode === 'skills' && !expanded) {
              return null;
            }

            return (
              <section
                key={sub.id}
                className="subject-container"
              >
                <button
                  className="subject-toggle"
                  onClick={() => toggleSubject(sub.id)}
                  style={{ '--c': sub.color }}
                >
                  <span>
                    {sub.emoji} {sub.name}
                  </span>

                  <span>
                    {expanded ? '−' : '+'}
                  </span>
                </button>

                {expanded && navigationMode !== 'subjects' && (
                  <Constellation
                    sub={sub}
                    statusOf={statusOf}
                    isAcquired={isAcquired}
                    mastery={mastery}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                )}

                {navigationMode === 'subjects' && (
                  <div className="subject-skills-list">
                    {sub.skills.map((s) => (
                      <button
                        key={s.id}
                        className={`subject-skill ${selectedId === s.id ? 'selected' : ''}`}
                        onClick={() => setSelectedId(s.id)}
                      >
                        <span>{s.name}</span>
                        <span>{Math.round(mastery(s.id))}%</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <aside className="panel" aria-live="polite">
          {selected ? (
            <DetailPanel
              s={selected}
              status={statusOf(selected)}
              m={mastery(selected.id)}
              n={countOf(selected.id)}
              prereqs={(selected.prereq ?? []).map((p) => ({
                id: p,
                name: allSkills[p]?.name ?? p,
                ok: mastery(p) >= 50,
              }))}
              onStart={onStart}
            />
          ) : (
            <div className="panel-empty">
              <span className="sigil">✦</span>

              <p>
                Choisis une compétence pour voir son détail
                et commencer à travailler.
              </p>

              <p className="legend">
                <span className="dot dark" /> non acquise
                <span className="dot bright" /> acquise
              </p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function Constellation({
  sub,
  statusOf,
  isAcquired,
  mastery,
  selectedId,
  onSelect,
}) {
  const pos = Object.fromEntries(
    sub.skills.map((s) => [
      s.id,
      {
        x: s.pos?.[0] ?? 100,
        y: s.pos?.[1] ?? 100,
      },
    ])
  );

  const gid = `grad-${sub.id}`;
  const fid = `glow-${sub.id}`;

  const done = sub.skills.filter((s) =>
    isAcquired(s.id)
  ).length;

  const edges = sub.skills.flatMap((s) =>
    (s.prereq ?? [])
      .filter((p) => pos[p])
      .map((p) => {
        const parentOk = isAcquired(p);
        const bothOk = parentOk && isAcquired(s.id);

        return {
          key: `${p}>${s.id}`,
          d: edgePath(pos[p], pos[s.id]),
          state: bothOk
            ? 'lit'
            : parentOk
              ? 'half'
              : 'dark',
        };
      })
  );

  return (
    <section
      className="constellation"
      style={{ '--c': sub.color }}
    >
      <header className="const-head">
        <h2>
          <span className="emoji">{sub.emoji}</span>
          {sub.name}
        </h2>

        <span className="const-count">
          {done} / {sub.skills.length}
        </span>
      </header>

      <div className="const-svg-wrapper">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="const-svg"
          role="group"
          aria-label={sub.name}
        >
          <defs>
            <radialGradient
              id={gid}
              cx="35%"
              cy="30%"
              r="75%"
            >
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="30%" stopColor={sub.color} />
              <stop
                offset="100%"
                stopColor={sub.color}
                stopOpacity="0.5"
              />
            </radialGradient>

            <filter
              id={fid}
              x="-60%"
              y="-60%"
              width="220%"
              height="220%"
            >
              <feGaussianBlur
                stdDeviation="4"
                result="blur"
              />

              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g className="edges">
            {edges.map((e) => (
              <path
                key={e.key}
                d={e.d}
                className={`edge ${e.state}`}
                filter={
                  e.state === 'lit'
                    ? `url(#${fid})`
                    : undefined
                }
              />
            ))}
          </g>

          <g className="nodes">
            {sub.skills.map((s) => {
              const st = statusOf(s);
              const acq = st === 'acquired';
              const m = mastery(s.id);
              const { x, y } = pos[s.id];
              const isSel = selectedId === s.id;

              return (
                <g
                  key={s.id}
                  className={`node ${st}${isSel ? ' selected' : ''}`}
                  transform={`translate(${x} ${y})`}
                  tabIndex={0}
                  role="button"
                  aria-label={s.name}
                  onClick={() => onSelect(s.id)}
                  onKeyDown={(e) => {
                    if (
                      e.key === 'Enter' ||
                      e.key === ' '
                    ) {
                      e.preventDefault();
                      onSelect(s.id);
                    }
                  }}
                >
                  {acq && (
                    <circle
                      r={R + 16}
                      className="halo"
                      fill={sub.color}
                      filter={`url(#${fid})`}
                    />
                  )}

                  {acq && (
                    <circle
                      r={R + 7}
                      className="pulse"
                      stroke={sub.color}
                    />
                  )}

                  {isSel && (
                    <circle
                      r={R + 11}
                      className="sel-ring"
                    />
                  )}

                  <circle
                    r={R}
                    className="core"
                    fill={
                      acq
                        ? `url(#${gid})`
                        : undefined
                    }
                    stroke={
                      acq ? '#ffffff' : sub.color
                    }
                  />

                  {st === 'available' && (
                    <>
                      <circle
                        r={ARC_R}
                        className="arc-bg"
                        stroke={sub.color}
                      />

                      <circle
                        r={ARC_R}
                        className="arc"
                        stroke={sub.color}
                        strokeDasharray={`${(ARC_C * m) / 100} ${ARC_C}`}
                        transform="rotate(-90)"
                      />

                      <text
                        className="pct"
                        textAnchor="middle"
                        dominantBaseline="central"
                        y="1"
                      >
                        {Math.round(m)}%
                      </text>
                    </>
                  )}

                  {st === 'locked' && (
                    <text
                      className="glyph"
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      🔒
                    </text>
                  )}

                  {acq && (
                    <text
                      className="glyph star"
                      textAnchor="middle"
                      dominantBaseline="central"
                    >
                      ★
                    </text>
                  )}

                  <text
                    className="label"
                    y={R + 24}
                    textAnchor="middle"
                  >
                    {s.short ?? s.name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </section>
  );
}

function DetailPanel({
  s,
  status,
  m,
  n,
  prereqs,
  onStart,
}) {
  const label =
    status === 'locked'
      ? 'Verrouillée'
      : status === 'acquired'
        ? 'Acquise'
        : m > 0
          ? 'En cours'
          : 'Disponible';

  const disabled = status === 'locked' || n === 0;

  const buttonText =
    status === 'locked'
      ? 'Verrouillée'
      : n === 0
        ? 'Contenu à venir'
        : 'Lancer la session';

  return (
    <div
      className={`panel-inner ${status}`}
      style={{ '--c': s.color }}
    >
      <span className={`badge ${status}`}>
        {label}
      </span>

      <h3>{s.name}</h3>

      <p className="desc">{s.description}</p>

      <div className="mastery-head">
        <span>Maîtrise</span>
        <b>{Math.round(m)} %</b>
      </div>

      <div className="mastery-bar">
        <div style={{ width: `${m}%` }} />
      </div>

      <ol className="levels">
        {LEVELS.map(([name, t]) => (
          <li
            key={name}
            className={m >= t ? 'reached' : ''}
          >
            {name}
          </li>
        ))}
      </ol>

      {prereqs.length > 0 && (
        <>
          <h4>Prérequis</h4>

          <ul className="prereqs">
            {prereqs.map((p) => (
              <li
                key={p.id}
                className={p.ok ? 'ok' : 'todo'}
              >
                <span>{p.ok ? '✓' : '○'}</span>
                {p.name}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="panel-foot">
        <span className="qcount">
          {n} question{n > 1 ? 's' : ''}
        </span>

        <button
          className="btn-primary"
          disabled={disabled}
          onClick={() => onStart(s)}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
}