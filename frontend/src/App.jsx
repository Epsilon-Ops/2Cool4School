import React, { useEffect, useMemo, useState } from 'react';

import { subjects, questionBank } from './data/subjectLoader.js';
import { loadProgress, saveProgress, touchStreak } from './engine/progress.js';
import { buildStats, recordAnswer } from './engine/mastery.js';
import { resetSkill, togglePause, markAcquired } from './engine/skillActions.js';

import SkillTree from './components/SkillTree.jsx';
import Session from './components/Session.jsx';
import Passport from './components/Passport.jsx';
import Mascot from './components/Mascot.jsx';
import Cours from './components/Cours.jsx';

const DEFAULT_CONFIG = { count: 5, strategy: 'weighted', mode: 'skill', explain: 'normal' };
const MIX_LABELS = {
  mix: 'Mode aléatoire',
  reprise: 'Mes erreurs',
  assimilation: 'Mes lacunes',
  spontaneous: 'Mode spontané',
};

const allSkills = subjects.flatMap((sub) =>
  sub.skills.map((s) => ({ ...s, color: sub.color, subjectName: sub.name }))
);

export default function App() {
  const [progress, setProgress] = useState(() => touchStreak(loadProgress()));
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [view, setView] = useState({ name: 'tree' });
  const [toast, setToast] = useState(null);

  // Statistiques dérivées : recalculées à chaque réponse, jamais stockées.
  const stats = useMemo(() => buildStats(allSkills, questionBank, progress), [progress]);

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const level = Math.floor(progress.xp / 100) + 1;
  const xpIntoLevel = progress.xp % 100;

  const handleAnswer = (q, ok, quality, format) => {
    const next = recordAnswer(progress, questionBank, q, ok, quality, format);
    if (!progress.skills[q.skill]?.certified && next.skills[q.skill]?.certified) {
      const skill = allSkills.find((s) => s.id === q.skill);
      setToast(skill?.name ?? 'Nouvelle compétence');
    }
    setProgress(next);
  };

  const setGoal = (kind, value, subjectId) =>
    setProgress((p) =>
      kind === 'global'
        ? { ...p, goals: { ...p.goals, global: value } }
        : { ...p, goals: { ...p.goals, subjects: { ...p.goals.subjects, [subjectId]: value } } }
    );

  const toggleGuided = () =>
    setProgress((p) => ({ ...p, prefs: { ...p.prefs, guided: !p.prefs.guided } }));

  const skillAction = (kind, id) => {
    if (kind === 'reset' && !window.confirm('Réinitialiser efface les réponses et la certification de cette compétence. Continuer ?')) return;
    setProgress((p) =>
      kind === 'reset' ? resetSkill(p, questionBank, id)
      : kind === 'pause' ? togglePause(p, id)
      : markAcquired(p, id)
    );
  };

  const startSkill = (skill, cfg = config) => {
    setView({ name: 'session', skill, config: cfg, id: Date.now() });
  };

  const startReview = () =>
    startSkill({ id: null, name: 'Révisions', color: '#1cb0f6', review: true }, config);

  const startMix = (mode) =>
    startSkill({ id: null, name: MIX_LABELS[mode], color: '#ce82ff', mix: true }, { ...config, mode });

  const goHome = () => setView({ name: 'tree' });
  const openSkill = (id) => setView({ name: 'tree', focus: id });

  const showTabs = view.name === 'tree' || view.name === 'passport' || view.name === 'cours';

  const startPractice = (section) =>
    startSkill(
      { id: null, name: section.title, mix: true, questionIds: section.questionIds },
      { ...config, mode: 'spontaneous' }
    );

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-in">
          <button className="brand" onClick={goHome} aria-label="Retour à l'accueil">
            <Mascot size={42} />
            <span>2Cool4School</span>
          </button>

          <div className="stats">
            <span className="chip xp" title="Points d'expérience">
              <span className="ico" aria-hidden="true">⚡</span>
              <span key={progress.xp} className="pop">{progress.xp}</span>
              <span className="unit-label">XP</span>
            </span>
            <span className="chip streak" title="Jours consécutifs">
              <span className="ico" aria-hidden="true">🔥</span>
              <span key={progress.streak} className="pop">{progress.streak}</span>
              <span className="unit-label">j</span>
            </span>
            <span className="chip lvl" title={`${xpIntoLevel}/100 XP vers le niveau suivant`}>
              <span className="ico" aria-hidden="true">🏆</span>
              <span>Niv. {level}</span>
              <span className="lvl-bar" aria-hidden="true"><i style={{ width: `${xpIntoLevel}%` }} /></span>
            </span>
          </div>
        </div>
        {showTabs && (
          <nav className="tabs" aria-label="Vues">
            <button className={view.name === 'tree' ? 'on' : ''} onClick={goHome} aria-current={view.name === 'tree'}>Parcours</button>
            <button
              className={view.name === 'passport' ? 'on' : ''}
              onClick={() => setView({ name: 'passport' })}
              aria-current={view.name === 'passport'}
            >
              Passeport
            </button>
            <button
              className={view.name === 'cours' ? 'on' : ''}
              onClick={() => setView({ name: 'cours' })}
              aria-current={view.name === 'cours'}
            >
              Cours
            </button>
          </nav>
        )}
      </header>

      <main className="page">
        {view.name === 'tree' && (
          <SkillTree
            subjects={subjects}
            bank={questionBank}
            stats={stats}
            progress={progress}
            config={config}
            setConfig={setConfig}
            guided={progress.prefs.guided}
            onToggleGuided={toggleGuided}
            focusId={view.focus}
            onStart={startSkill}
            onReview={startReview}
            onSkillAction={skillAction}
            onMix={startMix}
          />
        )}

        {view.name === 'passport' && (
          <Passport
            subjects={subjects}
            stats={stats}
            progress={progress}
            onOpenSkill={openSkill}
            onSetGoal={setGoal}
            onMix={startMix}
          />
        )}

        {view.name === 'cours' && <Cours subjects={subjects} onPractice={startPractice} />}

        {view.name === 'session' && (
          <Session
            key={view.id}
            skill={view.skill}
            bank={questionBank}
            config={view.config}
            progress={progress}
            stats={stats}
            onAnswer={handleAnswer}
            onExit={goHome}
          />
        )}
      </main>

      {toast && (
        <div className="toast" role="status">
          <span aria-hidden="true">🏅</span> Compétence certifiée : <b>{toast}</b>
        </div>
      )}
    </div>
  );
}
