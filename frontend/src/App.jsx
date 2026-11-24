import React, { useEffect, useMemo, useRef, useState } from 'react';

import { subjects, questionBank } from './data/utils/subjectLoader.js';
import { courses } from './data/utils/courseLoader.js';
import { loadProgress, saveProgress, touchStreak } from './engine/progress.js';
import { buildStats, recordAnswer } from './engine/mastery.js';
import { resetSkill, togglePause, markAcquired } from './engine/skillActions.js';
import { applyGamification, domainOpen, flatSkills } from './engine/gamification.js';
import { regularWeeks, dayKey } from './engine/activity.js';
import { levelInfo } from './engine/levels.js';
import Streaks from './components/Streaks.jsx';

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

/** Jours consécutifs d'activité se terminant aujourd'hui (ou hier, sans encore de réponse aujourd'hui). */
function currentDayStreak(activity = {}) {
  const has = (d) => (activity[dayKey(d.getTime())] ?? 0) > 0;
  const d = new Date();
  if (!has(d)) d.setDate(d.getDate() - 1);
  let n = 0;
  while (has(d)) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

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
  // Questions jouables (hors brouillons) : seules elles comptent pour valider un cours.
  const playableIds = useMemo(() => new Set(questionBank.map((q) => q.id)), []);

  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  // Hauteur réelle de la barre du haut : les en-têtes de matière collent juste en dessous.
  const topbarRef = useRef(null);
  useEffect(() => {
    const el = topbarRef.current;
    if (!el) return undefined;
    const apply = () => document.documentElement.style.setProperty('--topbar-h', `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view.name]);

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

  const lvl = levelInfo(progress.xp);
  const streakDays = currentDayStreak(progress.activity);
  const regular = regularWeeks(progress.activity);
  const mascotColor = progress.profile?.color ?? '#f85211';

  const handleAnswer = (q, ok, quality, format, verified = true) => {
    const next = recordAnswer(progress, questionBank, q, ok, quality, format, verified);
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

  const showTabs = ['tree', 'passport', 'succes', 'cours', 'streaks'].includes(view.name);

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
      <header className="topbar" ref={topbarRef}>
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
            <button className="chip streak" onClick={() => setView({ name: 'streaks' })} title="Série de jours et semaines régulières : voir la rubrique Streaks">
              <span className="ico" aria-hidden="true">🔥</span>
              <span key={streakDays} className="pop">{streakDays}</span>
              <span className="unit-label">j · {regular} sem.</span>
            </button>
            <span className="chip lvl" title={`Niveau logarithmique : encore ${lvl.toNext} XP avant le niveau ${lvl.level + 1} (${lvl.pct} % du niveau actuel)`}>
              <span className="ico" aria-hidden="true">🏆</span>
              <span>Niv. {lvl.level} · {lvl.pct} %</span>
              <span className="lvl-bar" aria-hidden="true"><i style={{ width: `${lvl.pct}%` }} /></span>
              <small className="to-next">{lvl.toNext} XP</small>
            </span>
          </div>
        </div>
        {showTabs && (
          <nav className="tabs" aria-label="Vues">
            {tab('tree', 'Parcours')}
            {tab('passport', 'Passeport')}
            {tab('succes', 'Succès')}
            {tab('cours', 'Cours')}
            {tab('streaks', 'Streaks')}
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

        {view.name === 'streaks' && (
          <Streaks subjects={subjects} bank={questionBank} progress={progress} stats={stats} />
        )}

        {view.name === 'cours' && (
          <Cours subjects={subjects} progress={progress} onSeen={markSeen} onPractice={startPractice} playable={playableIds} />
        )}

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
