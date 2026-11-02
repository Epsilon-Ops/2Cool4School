import React, { useEffect, useState } from 'react';
import bank from './data/questions.json';
import skillsData from './data/skills.json';
import { loadProgress, saveProgress, applyAnswer, touchStreak } from './engine/progress.js';
import SkillTree from './components/SkillTree.jsx';
import Session from './components/Session.jsx';
import Mascot from './components/Mascot.jsx';

export default function App() {
  const [progress, setProgress] = useState(() => touchStreak(loadProgress()));
  const [config, setConfig] = useState({ count: 5, strategy: 'weighted' });
  const [view, setView] = useState({ name: 'tree' });

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  const level = Math.floor(progress.xp / 100) + 1;

  const handleAnswer = (q, ok, quality) => {
    setProgress((p) => applyAnswer(p, q, ok, quality));
  };

  const startSkill = (skill) => setView({ name: 'session', skill, id: Date.now() });

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Mascot size={44} />
          2Cool4School
        </div>
        <div className="stats">
          <span className="chip xp">⚡ {progress.xp} XP</span>
          <span className="chip streak">🔥 {progress.streak} j</span>
          <span className="chip lvl">Niveau {level}</span>
        </div>
      </header>

      <main>
        {view.name === 'tree' && (
          <SkillTree
            subjects={skillsData.subjects}
            bank={bank}
            progress={progress}
            config={config}
            setConfig={setConfig}
            onStart={startSkill}
          />
        )}
        {view.name === 'session' && (
          <Session
            key={view.id}
            skill={view.skill}
            bank={bank}
            config={config}
            progress={progress}
            onAnswer={handleAnswer}
            onExit={() => setView({ name: 'tree' })}
          />
        )}
      </main>
    </div>
  );
}
