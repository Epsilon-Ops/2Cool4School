import React, { useEffect, useState } from 'react';

import { subjects, questionBank } from './data/subjectLoader.js';
import { loadProgress, saveProgress, applyAnswer, touchStreak } from './engine/progress.js';

import SkillTree from './components/SkillTree.jsx';
import Session from './components/Session.jsx';
import Mascot from './components/Mascot.jsx';

const DEFAULT_CONFIG = { count: 5, strategy: 'weighted' };

export default function App() {
  const [progress, setProgress] = useState(() => touchStreak(loadProgress()));
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [view, setView] = useState({ name: 'tree' });

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  const level = Math.floor(progress.xp / 100) + 1;
  const xpIntoLevel = progress.xp % 100;

  const handleAnswer = (q, ok, quality) => {
    setProgress((p) => applyAnswer(p, q, ok, quality));
  };

  const startSkill = (skill, cfg = config) => {
    setView({ name: 'session', skill, config: cfg, id: Date.now() });
  };

  const startReview = () =>
    startSkill({ id: null, name: 'Révisions', color: '#1cb0f6', review: true }, config);

  const goHome = () => setView({ name: 'tree' });

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
      </header>

      <main className="page">
        {view.name === 'tree' && (
          <SkillTree
            subjects={subjects}
            bank={questionBank}
            progress={progress}
            config={config}
            setConfig={setConfig}
            onStart={startSkill}
            onReview={startReview}
          />
        )}

        {view.name === 'session' && (
          <Session
            key={view.id}
            skill={view.skill}
            bank={questionBank}
            config={view.config}
            progress={progress}
            onAnswer={handleAnswer}
            onExit={goHome}
          />
        )}
      </main>
    </div>
  );
}
