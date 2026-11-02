import { levelOf } from '../engine/progress.js';
import React from 'react';

const COUNTS = [3, 5, 10];
const STRATEGIES = [
  ['weighted', 'Pondéré (lacunes)'],
  ['random', 'Aléatoire'],
  ['unseen', 'Jamais vues'],
  ['progressive', 'Difficulté croissante'],
];

export default function SkillTree({ subjects, bank, progress, config, setConfig, onStart }) {
  const mastery = (id) => progress.skills[id]?.mastery ?? 0;
  const allSkills = Object.fromEntries(subjects.flatMap((s) => s.skills).map((s) => [s.id, s]));
  const countOf = (id) => bank.filter((q) => q.skill === id).length;

  return (
    <>
      <section className="config">
        <div>
          <span>Questions</span>
          {COUNTS.map((n) => (
            <button key={n} className={`pill ${config.count === n ? 'on' : ''}`} onClick={() => setConfig({ ...config, count: n })}>
              {n}
            </button>
          ))}
        </div>
        <div>
          <span>Ordre</span>
          {STRATEGIES.map(([id, label]) => (
            <button key={id} className={`pill ${config.strategy === id ? 'on' : ''}`} onClick={() => setConfig({ ...config, strategy: id })}>
              {label}
            </button>
          ))}
        </div>
      </section>

      {subjects.map((sub) => (
        <section key={sub.id} className="branch" style={{ '--c': sub.color }}>
          <h2>{sub.emoji} {sub.name}</h2>
          <ol className="path">
            {sub.skills.map((s, idx) => {
              const m = mastery(s.id);
              const unlocked = (s.prereq ?? []).every((p) => mastery(p) >= 50);
              const status = !unlocked ? 'locked' : m >= 80 ? 'mastered' : 'open';
              const n = countOf(s.id);
              return (
                <li key={s.id} className={`node ${status}`}>
                  <button className="bubble" disabled={status === 'locked' || n === 0} onClick={() => onStart(s)}>
                    {status === 'locked' ? '🔒' : status === 'mastered' ? '★' : idx + 1}
                  </button>
                  <div className="node-info">
                    <strong>{s.name}</strong>
                    <small>
                      {status === 'locked'
                        ? `Prérequis : ${s.prereq.map((p) => allSkills[p]?.name ?? p).join(', ')}`
                        : `${levelOf(m)} · ${n} questions · ${Math.round(m)} %`}
                    </small>
                    <div className="meter"><div style={{ width: `${m}%` }} /></div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </>
  );
}
