import { Fragment } from 'react';
import { dayStreaks, periodTable, learningGrid, PERIODS } from '../engine/streaks.js';
import { regularWeeks } from '../engine/activity.js';

const DAY_LABEL = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const pct = (v) => (v === null ? '—' : `${v} %`);
const gainTxt = (v) => (v === null ? '—' : `${v > 0 ? '+' : ''}${v} pts`);

/** Intensité d'une case : nombre de réponses du jour, de 1 à 8 ou plus. */
const alpha = (n) => (n === 0 ? 0 : 0.25 + 0.75 * Math.min(1, n / 8));

/** Vue « Streaks » : séries, tableau d'apprentissage coloré par jour et par matière, progressions par période. */
export default function Streaks({ subjects, bank, progress, stats }) {
  const streak = dayStreaks(progress.activity ?? {});
  const weeks = regularWeeks(progress.activity ?? {});
  const grid = learningGrid(progress, bank, subjects, 84);
  const table = periodTable(progress, bank, subjects, stats);
  const activeSubjects = subjects.filter((s) => grid.rows.find((r) => r.id === s.id)?.cells.some((c) => c.n > 0));

  return (
    <div className="streaks">
      <section className="streak-cards">
        <div><span>Série en cours</span><b>{streak.current} j</b><small>jours d’affilée avec au moins une réponse</small></div>
        <div><span>Record</span><b>{streak.best} j</b><small>plus longue série</small></div>
        <div><span>Semaines régulières</span><b>{weeks}</b><small>au moins 2 jours d’activité par semaine</small></div>
        <div><span>Jours actifs</span><b>{streak.active}</b><small>depuis le début</small></div>
      </section>

      <section className="panel">
        <h3>Apprentissage des 12 dernières semaines</h3>
        <p className="muted small">Chaque case est un jour : plus elle est colorée, plus tu as répondu ce jour-là dans la matière.</p>
        <div className="grid-scroll">
          <div className="learn-grid" style={{ gridTemplateColumns: `150px repeat(${grid.keys.length}, 14px)` }}>
            <span />
            {grid.keys.map((k, i) => (
              <span key={k} className="learn-tick">{i % 7 === 0 ? k.slice(8) : ''}</span>
            ))}
            {grid.rows.map((row) => (
              <Fragment key={row.id}>
                <span key={`${row.id}-name`} className="learn-name" style={{ '--c': row.color }}>{row.name}</span>
                {row.cells.map((c) => (
                  <span
                    key={`${row.id}-${c.day}`}
                    className={`learn-cell${c.n ? ' on' : ''}`}
                    style={{ '--c': row.color, opacity: c.n ? 0.25 + 0.75 * Math.min(1, c.n / 8) : 1 }}
                    title={c.n ? `${row.name} · ${DAY_LABEL.format(new Date(c.day))} : ${c.n} question${c.n > 1 ? 's' : ''} (${c.ok} réussie${c.ok > 1 ? 's' : ''})` : `${row.name} · ${DAY_LABEL.format(new Date(c.day))} : aucune`}
                    aria-label={c.n ? `${row.name}, ${c.day} : ${c.n} questions` : `${row.name}, ${c.day} : aucune question`}
                  />
                ))}
              </Fragment>
            ))}
          </div>
        </div>
        {activeSubjects.length === 0 && <p className="muted small">Aucune réponse enregistrée pour l’instant.</p>}
      </section>

      <section className="panel">
        <h3>Questions et progression par période</h3>
        <p className="muted small">
          <b>Réussite</b> : part des réponses justes. <b>Progression</b> : gain moyen de maîtrise sur les compétences
          travaillées pendant la période, depuis son début (0 si la compétence n’était pas encore travaillée).
        </p>
        <div className="table-scroll">
          <table className="streak-table">
            <thead>
              <tr>
                <th rowSpan={2}>Matière</th>
                {PERIODS.map(([k, label]) => (
                  <th key={k} colSpan={3}>{label}</th>
                ))}
              </tr>
              <tr>
                {PERIODS.map(([k]) => (
                  <Fragment key={k}>
                    <th>Questions</th>
                    <th>Réussite</th>
                    <th>Progression</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...subjects, { id: 'total', name: 'Total' }].map((sub) => (
                <tr key={sub.id} className={sub.id === 'total' ? 'total' : ''}>
                  <th>{sub.name}</th>
                  {PERIODS.map(([k]) => {
                    const r = table[k].rows[sub.id] ?? { n: 0, pct: null, gain: null };
                    return (
                      <Fragment key={k}>
                        <td>{r.n}</td>
                        <td>{pct(r.pct)}</td>
                        <td className={r.gain > 0 ? 'up' : r.gain < 0 ? 'down' : ''}>{gainTxt(r.gain)}</td>
                      </Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
