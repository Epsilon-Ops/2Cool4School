import React, { useEffect, useMemo, useState } from 'react';

import { subjects, questionBank } from './data/utils/subjectLoader.js';
import { courses } from './data/utils/courseLoader.js';
import { loadProgress, saveProgress, touchStreak } from './engine/progress.js';
import { buildStats, recordAnswer } from './engine/mastery.js';
import { resetSkill, togglePause, markAcquired } from './engine/skillActions.js';
import { applyGamification, domainOpen, flatSkills } from './engine/gamification.js';
import { regularWeeks } from './engine/activity.js';

import SkillTree from './components/SkillTree.jsx';
import Session from './components/Session.jsx';
import Passport from './components/Passport.jsx';
import Trophies from './components/Trophies.jsx';
import Mascot from './components/Mascot.jsx';
import Cours from './components/Cours.jsx';

const DEFAULT_CONFIG = { count: 5, strategy: 'weighted', mode: 'skill', explain: 'normal' };
const MIX_LABELS = {
  mix: 'Mode aléatoire',
  reprise: 'Mes erreurs',
  assimilation: 'Mes lacunes',
  spontaneous: 'Mode spontané',
};

const allSkills = flatSkills(subjects).map((s) => ({ ...s, color: subjects.find((x) => x.id === s.subjectId)?.color }));

export default function App() {
  const [progress, setProgress] = useState(() => touchStreak(loadProgress()));
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [view, setView] = useState({ name: 'tree' });
  const [toasts, setToasts] = useState([]);

  // Statistiques dérivées : recalculées à chaque réponse, jamais stockées.
  const stats = useMemo(() => buildStats(allSkills, questionBank, progress), [progress]);
  const certCount = useMemo(
    () => allSkills.filter((s) => stats.byId[s.id]?.qCount > 0 && stats.byId[s.id].certified).length,
    [stats]
  );
  const isDomainOpen = (id) => domainOpen(id, certCount, progress);

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  // Succès, défis et objectifs : évalués après chaque changement. Sans changement, la référence est conservée : pas de boucle.
  useEffect(() => {
    const { progress: next, unlocked } = applyGamification(progress, subjects, questionBank, courses);
    if (next === progress) return;
    setProgress(next);
    if (unlocked.length) {
      setToasts((ts) => [...ts, ...unlocked.map((u) => ({ id: Math.random(), text: u.label, reward: u.reward }))]);
    }
  }, [progress]);

  useEffect(() => {
    if (!toasts.length) return undefined;
    const t = setTimeout(() => setToasts((ts) => ts.slice(1)), 3500);
    return () => clearTimeout(t);
  }, [toasts]);

  const level = Math.floor(progress.xp / 100) + 1;
  const xpIntoLevel = progress.xp % 100;
  const regular = regularWeeks(progress.activity);
  const mascotColor = progress.profile?.color ?? '#f85211';

  const handleAnswer = (q, ok, quality, format) => {
    const next = recordAnswer(progress, questionBank, q, ok, quality, format);
    if (!progress.skills[q.skill]?.certified && next.skills[q.skill]?.certified) {
      const skill = allSkills.find((s) => s.id === q.skill);
      setToasts((ts) => [...ts, { id: Math.random(), text: `Compétence certifiée : ${skill?.name ?? 'nouvelle compétence'}` }]);
    }
    setProgress(next);
  };

  /** Mise à jour de la progression depuis les vues (objectifs, défis, profil). */
  const updateProgress = (fn) => setProgress((p) => fn(p));

  const setGoal = (kind, value, subjectId) =>
    updateProgress((p) =>
      kind === 'global'
        ? { ...p, goals: { ...p.goals, global: value } }
        : { ...p, goals: { ...p.goals, subjects: { ...p.goals.subjects, [subjectId]: value } } }
    );

  const toggleGuided = () =>
    updateProgress((p) => ({ ...p, prefs: { ...p.prefs, guided: !p.prefs.guided } }));

  const skillAction = (kind, id) => {
    if (kind === 'reset' && !window.confirm('Réinitialiser efface les réponses et la certification de cette compétence. Continuer ?')) return;
    updateProgress((p) =>
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

  const showTabs = ['tree', 'passport', 'succes', 'cours'].includes(view.name);

  const markSeen = (courseId, key) =>
    updateProgress((p) => ({
      ...p,
      course: { ...p.course, [courseId]: { ...(p.course?.[courseId] ?? {}), [key]: true } },
    }));

  const startPractice = (section, count) =>
    startSkill(
      { id: null, name: section.title, mix: true, questionIds: section.questionIds },
      { ...config, mode: 'spontaneous', count }
    );

  const tab = (name, label) => (
    <button className={view.name === name ? 'on' : ''} onClick={() => setView({ name })} aria-current={view.name === name}>
      {label}
    </button>
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-in">
          <button className="brand" onClick={goHome} aria-label="Retour à l'accueil">
            <Mascot size={42} color={mascotColor} />
            <span>2Cool4School</span>
          </button>

          <div className="stats">
            <span className="chip xp" title="Points d'expérience : plus de points sur les exercices que tu maîtrises encore peu">
              <span className="ico" aria-hidden="true">⚡</span>
              <span key={progress.xp} className="pop">{progress.xp}</span>
              <span className="unit-label">XP</span>
            </span>
            <span className="chip streak" title="Semaines régulières (au moins 2 jours d'activité). Les pauses ne font rien perdre.">
              <span className="ico" aria-hidden="true">🔥</span>
              <span key={regular} className="pop">{regular}</span>
              <span className="unit-label">sem.</span>
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
            {tab('tree', 'Parcours')}
            {tab('passport', 'Passeport')}
            {tab('succes', 'Succès')}
            {tab('cours', 'Cours')}
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
            isDomainOpen={isDomainOpen}
          />
        )}

        {view.name === 'passport' && (
          <Passport
            subjects={subjects}
            stats={stats}
            progress={progress}
            courses={courses}
            bank={questionBank}
            onOpenSkill={openSkill}
            onSetGoal={setGoal}
            onMix={startMix}
          />
        )}

        {view.name === 'succes' && (
          <Trophies subjects={subjects} bank={questionBank} courses={courses} progress={progress} onUpdate={updateProgress} />
        )}

        {view.name === 'cours' && <Cours subjects={subjects} progress={progress} onSeen={markSeen} onPractice={startPractice} />}

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

      {toasts.length > 0 && (
        <div className="toast-stack" role="status" aria-live="polite">
          <div className="toast">
            {toasts[0].reward !== undefined ? (
              <>
                <span aria-hidden="true">🏅</span> Succès : <b>{toasts[0].text}</b>
                {toasts[0].reward > 0 && <em> +{toasts[0].reward} XP</em>}
              </>
            ) : (
              <>
                <span aria-hidden="true">🏅</span> <b>{toasts[0].text}</b>
              </>
            )}
            {toasts.length > 1 && <small> · +{toasts.length - 1} autre{toasts.length > 2 ? 's' : ''}</small>}
          </div>
        </div>
      )}
    </div>
  );
}
