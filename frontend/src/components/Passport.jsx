const GLOBAL_GOALS = [3, 5, 10, 20];
const SUBJECT_GOALS = [50, 70, 80, 90];
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

/** Passeport de connaissances : tableau de maîtrise par compétence, lacunes, certifications, objectifs. */
export default function Passport({ subjects, stats, progress, onOpenSkill, onSetGoal, onMix }) {
  const { byId, gaps, blockers } = stats;
  const st = (id) => byId[id] ?? { qCount: 0, mastery: 0 };
  const nameOf = (id) => subjects.flatMap((s) => s.skills).find((s) => s.id === id)?.name ?? id;

  const playableIds = subjects.flatMap((s) => s.skills.map((k) => k.id)).filter((id) => st(id).qCount > 0);
  const certified = playableIds.filter((id) => st(id).certified);
  const avgOf = (ids) => (ids.length ? Math.round(ids.reduce((a, id) => a + st(id).mastery, 0) / ids.length) : 0);
  const globalAvg = avgOf(playableIds);
  const globalGoal = progress.goals.global;
  const globalPct = globalGoal > 0 ? Math.min(100, (certified.length / globalGoal) * 100) : 0;

  return (
    <div className="passport">
      <section className="hero">
        <div className="hero-main">
          <span className="eyebrow">Passeport de connaissances</span>
          <h1>
            {certified.length}
            <span> / {playableIds.length} compétences certifiées</span>
          </h1>
          <p className="muted">Maîtrise moyenne : <b>{globalAvg} %</b></p>
          <div className="hud-bar">
            <div style={{ width: `${globalAvg}%` }} />
          </div>
        </div>
      </section>

      <section className="panel">
        <h3>Objectif global</h3>
        <p className="muted">Certifier {plural(globalGoal, 'compétence')} · {certified.length} / {globalGoal}</p>
        <div className="goal-row">
          {GLOBAL_GOALS.map((n) => (
            <button key={n} className={`pill ${globalGoal === n ? 'on' : ''}`} onClick={() => onSetGoal('global', n)}>{n}</button>
          ))}
        </div>
        <div className="progress-line"><div style={{ width: `${globalPct}%` }} /></div>
      </section>

      {gaps.length > 0 && (
        <section className="panel warn">
          <h3>Lacunes détectées</h3>
          <ul className="gap-list">
            {gaps.map((id) => {
              const blocks = st(id).blocks ?? [];
              return (
                <li key={id}>
                  <button className="link" onClick={() => onOpenSkill(id)}>{nameOf(id)}</button>
                  {blockers.includes(id) && <span className="tag-block">bloquante</span>}
                  {blocks.length > 0 && <span className="muted"> · freine {blocks.map(nameOf).join(', ')}</span>}
                </li>
              );
            })}
          </ul>
          <button className="pill on" onClick={() => onMix('assimilation')}>Travailler mes lacunes</button>
        </section>
      )}

      {subjects.map((sub) => {
        const ids = sub.skills.map((k) => k.id).filter((id) => st(id).qCount > 0);
        const avg = avgOf(ids);
        const goal = progress.goals.subjects[sub.id] ?? 80;
        const pct = Math.min(100, (avg / goal) * 100);
        return (
          <section key={sub.id} className="panel" style={{ '--c': sub.color }}>
            <div className="panel-head">
              <h3>{sub.emoji} {sub.name}</h3>
              <span className="unit-code">{sub.code}</span>
            </div>
            <div className="table-wrap">
              <table className="passport">
                <thead>
                  <tr>
                    <th scope="col">Compétence</th>
                    <th scope="col">Maîtrise</th>
                    <th scope="col">Théorie</th>
                    <th scope="col">Pratique</th>
                    <th scope="col">Confiance</th>
                    <th scope="col">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {sub.skills.map((s) => {
                    const info = st(s.id);
                    if (!info.qCount) return null;
                    const status = info.certified ? 'Certifiée' : info.paused ? 'En pause' : info.gap ? 'Lacune' : info.events ? 'En cours' : 'À commencer';
                    return (
                      <tr key={s.id} className={info.gap ? 'is-gap' : ''}>
                        <td><button className="link" onClick={() => onOpenSkill(s.id)}>{s.name}</button></td>
                        <td>
                          <div className="mcell">
                            <b>{info.mastery} %</b>
                            <div className="mini-bar"><i style={{ width: `${info.mastery}%` }} /></div>
                          </div>
                        </td>
                        <td>{info.events ? `${info.theory} %` : '—'}</td>
                        <td>{info.hasPractice && info.events ? `${info.practice} %` : '—'}</td>
                        <td>{info.events ? `${info.confidenceLabel} (${info.confidence} %)` : '—'}</td>
                        <td><span className={`status ${info.certified ? 'ok' : info.gap ? 'gap' : ''}`}>{status}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="objective">
              <span>Objectif de maîtrise {goal} % · moyenne {avg} %</span>
              <div className="goal-row">
                {SUBJECT_GOALS.map((n) => (
                  <button key={n} className={`pill ${goal === n ? 'on' : ''}`} onClick={() => onSetGoal('subject', n, sub.id)}>{n} %</button>
                ))}
              </div>
              <div className="progress-line"><div style={{ width: `${pct}%` }} /></div>
            </div>
          </section>
        );
      })}

      <section className="panel">
        <h3>Certifications</h3>
        {certified.length === 0 ? (
          <p className="muted">
            Aucune compétence certifiée pour l’instant. Une certification demande une maîtrise solide,
            des réussites sur plusieurs jours et, si elle existe, une bonne pratique.
          </p>
        ) : (
          <ul className="cert-list">
            {certified.map((id) => (
              <li key={id}>
                <span>★</span> {nameOf(id)}
                <em>{new Date(st(id).certified).toLocaleDateString('fr-FR')}</em>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
