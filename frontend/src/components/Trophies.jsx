import { useState } from 'react';
import Mascot from './Mascot.jsx';
import {
  achievementStatus, knowledgeOf, unlockedTitles, availablePalette, historyOf,
  CHALLENGE_TEMPLATES, WEEKLY_TARGETS, GROUPS, challengeStatus,
} from '../engine/gamification.js';
import { weekAnswers, dailySeries, weeklySeries, regularWeeks } from '../engine/activity.js';

const BADGE_GROUPS = ['reussite', 'perseverance', 'polyvalence', 'maitrise', 'regularite', 'objectif', 'defi', 'domaine'];
const LEVEL_TIP = 'XP : un exercice nouveau rapporte davantage qu’un exercice déjà maîtrisé. Une erreur rapporte 2 XP.';
const fmtDate = (t) => new Date(t).toLocaleDateString('fr-FR');

/** Vue « Succès » : profil, régularité, défis, badges, compétences, projets, collections, historique. */
export default function Trophies({ subjects, bank, courses, progress, onUpdate }) {
  const items = achievementStatus(progress, subjects, bank, courses);
  const know = knowledgeOf(progress, subjects, bank, courses);
  const titles = unlockedTitles(progress, subjects, bank, courses);
  const unlockedCount = items.filter((i) => i.unlocked).length;
  const palette = availablePalette(Object.keys(progress.achievements ?? {}).length);
  const history = historyOf(progress, subjects).slice(0, 40);
  const ctx = know.ctx;

  const byGroup = (g) => items.filter((i) => i.group === g);
  const profile = progress.profile ?? {};

  const setProfile = (patch) => onUpdate((p) => ({ ...p, profile: { ...p.profile, ...patch } }));

  return (
    <div className="trophies">
      <section className="hero profile-hero" style={{ '--c': profile.color ?? '#f85211' }}>
        <div className="profile-avatar"><Mascot size={84} color={profile.color ?? '#f85211'} /></div>
        <div className="hero-main">
          <span className="eyebrow">Ton profil</span>
          <h1>
            {profile.name?.trim() || 'Apprenti·e'}
            <span> · {profile.title ? titles.find((t) => t.id === profile.title)?.title ?? '' : 'sans titre'}</span>
          </h1>
          <p className="muted">
            Niveau de connaissances : <b>{know.level.name}</b> · maîtrise moyenne <b>{know.avg} %</b>
            {know.next ? ` · encore ${Math.ceil(know.toNext)} points vers ${know.next.name}` : ' · niveau maximal'}
          </p>
          <div className="hud-bar"><div style={{ width: `${know.pct}%` }} /></div>
          <p className="muted small">{unlockedCount} / {items.length} succès obtenus · {titles.length} titre{titles.length > 1 ? 's' : ''} débloqué{titles.length > 1 ? 's' : ''}</p>
        </div>
      </section>

      <section className="panel">
        <h3>Personnalisation</h3>
        <label className="field">
          Pseudo
          <input
            className="text-input"
            maxLength={24}
            value={profile.name ?? ''}
            placeholder="Ton pseudo"
            onChange={(e) => setProfile({ name: e.target.value })}
          />
        </label>
        <label className="field">
          Titre affiché
          <select className="text-input" value={profile.title ?? ''} onChange={(e) => setProfile({ title: e.target.value || null })}>
            <option value="">Aucun titre</option>
            {titles.map((t) => (
              <option key={t.id} value={t.id}>{t.title} ({t.skill})</option>
            ))}
          </select>
        </label>
        <p className="muted small">Un titre se débloque en certifiant la compétence qui lui est associée.</p>
        <div className="palette" role="group" aria-label="Couleur de la mascotte">
          {palette.map((c) => (
            <button
              key={c.color}
              className={`swatch${profile.color === c.color ? ' on' : ''}`}
              style={{ '--sw': c.color }}
              disabled={!c.available}
              aria-pressed={profile.color === c.color}
              aria-label={c.available ? c.name : `${c.name}, se débloque avec ${c.need} succès`}
              title={c.available ? c.name : `Se débloque avec ${c.need} succès`}
              onClick={() => setProfile({ color: c.color })}
            >
              {!c.available && '🔒'}
            </button>
          ))}
        </div>
        <p className="muted small insight">{LEVEL_TIP}</p>
      </section>

      <section className="panel">
        <h3>Régularité</h3>
        <p className="muted">
          <b>{regularWeeks(progress.activity)}</b> semaine{regularWeeks(progress.activity) > 1 ? 's' : ''} régulière{regularWeeks(progress.activity) > 1 ? 's' : ''}
          {' '}(au moins 2 jours d’activité). Une pause ne retire rien : chaque semaine régulière compte.
        </p>
        <ActivityGrid activity={progress.activity} />
        <WeeklyBars activity={progress.activity} target={progress.weekly?.target} />
      </section>

      <section className="panel">
        <h3>Objectif hebdomadaire <span className="muted small">facultatif</span></h3>
        <WeeklyGoal progress={progress} onUpdate={onUpdate} />
      </section>

      <section className="panel">
        <h3>Défis personnels</h3>
        <ChallengeList progress={progress} ctx={ctx} onUpdate={onUpdate} />
      </section>

      <section className="panel">
        <h3>Badges</h3>
        {BADGE_GROUPS.map((g) => {
          const list = byGroup(g);
          if (!list.length) return null;
          const done = list.filter((i) => i.unlocked).length;
          return (
            <div className="badge-group" key={g}>
              <h4>{GROUPS[g]} <span className="muted small">{done} / {list.length}</span></h4>
              <ul className="badge-grid">
                {list.map((i) => <BadgeCard key={i.id} item={i} />)}
              </ul>
            </div>
          );
        })}
      </section>

      <Details title="Succès par compétence" count={`${byGroup('competence').filter((i) => i.unlocked).length} / ${byGroup('competence').length}`}>
        <p className="muted small">Trois paliers par compétence : premier contact, certification, expertise (95 %).</p>
        {subjects.map((sub) => {
          const ids = sub.skills.map((s) => s.id);
          const rows = items.filter((i) => i.group === 'competence' && ids.some((id) => i.id.endsWith(`:${id}`)));
          if (!rows.length) return null;
          return (
            <div key={sub.id} className="skill-succ" style={{ '--c': sub.color }}>
              <h4>{sub.emoji} {sub.name}</h4>
              {sub.skills.filter((s) => rows.some((r) => r.id.endsWith(`:${s.id}`))).map((s) => {
                const tiers = rows.filter((r) => r.id.endsWith(`:${s.id}`));
                return (
                  <div className="skill-row" key={s.id}>
                    <span className="skill-name">{s.short ?? s.name}</span>
                    {tiers.map((t) => (
                      <span key={t.id} className={`tier${t.unlocked ? ' on' : ''}`} title={`${t.label} : ${t.desc}`}>
                        {t.unlocked ? '★' : '☆'} {t.label.split(' : ')[0]}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </Details>

      <Details title="Projets réalisés" count={`${byGroup('projet').filter((i) => i.unlocked).length} / ${byGroup('projet').length}`}>
        <p className="muted small">Un cours est réalisé à 80 % : notions vues et exercices réussis.</p>
        <ul className="project-list">
          {byGroup('projet').map((i) => (
            <li key={i.id} className={i.unlocked ? 'done' : ''}>
              <span>{i.unlocked ? '✓' : '○'}</span>
              <span className="project-name">{i.label.replace('Projet réalisé : ', '')}</span>
              <div className="mini-bar"><i style={{ width: `${i.pct}%` }} /></div>
              <b>{i.pct} %</b>
            </li>
          ))}
        </ul>
      </Details>

      <Details title="Collections de certifications" count={`${byGroup('collection').filter((i) => i.unlocked).length} / ${byGroup('collection').length}`}>
        <ul className="collection-list">
          {byGroup('collection').map((i) => (
            <li key={i.id} className={i.unlocked ? 'done' : ''}>
              <div className="collection-head">
                <span>{i.unlocked ? '🏅' : '○'} {i.label.replace('Collection complète : ', '')}</span>
                <b>{i.value} / {i.target}</b>
              </div>
              <div className="progress-line"><div style={{ width: `${i.pct}%` }} /></div>
            </li>
          ))}
        </ul>
      </Details>

      <Details title="Historique" count={`${history.length} entrée${history.length > 1 ? 's' : ''}`}>
        {history.length === 0 ? (
          <p className="muted">Ton historique apparaîtra ici dès ta première réussite.</p>
        ) : (
          <ol className="history">
            {history.map((h, k) => (
              <li key={`${h.t}-${k}`}>
                <em>{fmtDate(h.t)}</em>
                <span>{h.label}</span>
              </li>
            ))}
          </ol>
        )}
      </Details>
    </div>
  );
}

function Details({ title, count, children }) {
  return (
    <details className="panel details-panel">
      <summary><h3>{title}</h3><span className="muted small">{count}</span></summary>
      <div className="details-body">{children}</div>
    </details>
  );
}

function BadgeCard({ item }) {
  return (
    <li className={`badge-card${item.unlocked ? ' on' : ''}`} title={item.desc}>
      <span className="badge-ico" aria-hidden="true">{item.unlocked ? '🏅' : '🔒'}</span>
      <div className="badge-txt">
        <b>{item.label}</b>
        <span className="muted small">{item.desc}</span>
        <div className="mini-bar"><i style={{ width: `${item.pct}%` }} /></div>
        <span className="small">{item.value} / {item.target}{item.reward ? ` · +${item.reward} XP` : ''}</span>
      </div>
    </li>
  );
}

/** Carte de 12 semaines : une case par jour, plus foncée selon le nombre de réponses. */
function ActivityGrid({ activity }) {
  const days = dailySeries(activity, 84);
  const level = (n) => (n === 0 ? 0 : n < 5 ? 1 : n < 15 ? 2 : 3);
  return (
    <div className="heatmap" role="img" aria-label="Activité des 12 dernières semaines">
      {days.map((d) => (
        <i key={d.day} className={`hm l${level(d.count)}`} title={`${new Date(d.day).toLocaleDateString('fr-FR')} : ${d.count} réponse${d.count > 1 ? 's' : ''}`} />
      ))}
    </div>
  );
}

function WeeklyBars({ activity, target }) {
  const weeks = weeklySeries(activity, 12);
  const max = Math.max(target ?? 0, ...weeks.map((w) => w.count), 1);
  return (
    <div className="weekbars" aria-label="Réponses par semaine">
      {weeks.map((w) => (
        <div key={w.week} className="wb" title={`Semaine du ${new Date(w.week).toLocaleDateString('fr-FR')} : ${w.count}`}>
          <i style={{ height: `${Math.round((w.count / max) * 100)}%` }} className={target && w.count >= target ? 'met' : ''} />
        </div>
      ))}
    </div>
  );
}

function WeeklyGoal({ progress, onUpdate }) {
  const target = progress.weekly?.target ?? null;
  const done = weekAnswers(progress.activity);
  const met = target ? Boolean(progress.weeklyMet?.[weekKeyNow()]) : false;
  const set = (value) => onUpdate((p) => ({ ...p, weekly: { ...p.weekly, target: value } }));
  return (
    <>
      <div className="goal-row">
        <button className={`pill ${target === null ? 'on' : ''}`} onClick={() => set(null)}>Désactivé</button>
        {WEEKLY_TARGETS.filter(Boolean).map((n) => (
          <button key={n} className={`pill ${target === n ? 'on' : ''}`} onClick={() => set(n)}>{n} réponses</button>
        ))}
      </div>
      {target ? (
        <>
          <p className="muted">Cette semaine : <b>{done} / {target}</b>{met ? ' · objectif atteint ✓' : ''}</p>
          <div className="progress-line"><div style={{ width: `${Math.min(100, (done / target) * 100)}%` }} /></div>
          <p className="muted small">Sans objectif, rien ne change. Manquer une semaine ne fait rien perdre.</p>
        </>
      ) : (
        <p className="muted small">Optionnel : fixe un nombre de réponses par semaine si tu veux un repère.</p>
      )}
    </>
  );
}

const weekKeyNow = () => {
  const d = new Date();
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${String(d.getDate()).padStart(2, '0')}`;
};

function ChallengeList({ progress, ctx, onUpdate }) {
  const [draft, setDraft] = useState({ title: '', kind: 'answers', target: 20, days: 7 });
  const challenges = progress.challenges ?? [];

  const add = (c) =>
    onUpdate((p) => ({
      ...p,
      challenges: [...(p.challenges ?? []), { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, start: Date.now(), ...c }],
    }));
  const remove = (id) => onUpdate((p) => ({ ...p, challenges: (p.challenges ?? []).filter((c) => c.id !== id) }));

  const kindLabel = { answers: 'réponses', days: 'jours actifs', certs: 'certifications' };
  const submit = (e) => {
    e.preventDefault();
    const target = Math.max(1, Math.min(500, Number(draft.target) || 1));
    const days = Math.max(1, Math.min(90, Number(draft.days) || 7));
    const kind = draft.kind;
    const title = draft.title.trim() || `${target} ${kindLabel[kind]} en ${days} jours`;
    add({ title, kind, target, days });
    setDraft({ ...draft, title: '' });
  };

  return (
    <>
      {challenges.length === 0 && <p className="muted">Aucun défi en cours. Lance-toi un défi, ou choisis un modèle ci-dessous.</p>}
      <ul className="challenge-list">
        {challenges.map((c) => {
          const st = challengeStatus(c, ctx);
          const state = st.done ? 'done' : st.expired ? 'expired' : 'open';
          return (
            <li key={c.id} className={state}>
              <div className="challenge-head">
                <span>{st.done ? '🏅' : st.expired ? '⌛' : '🎯'} {c.title}</span>
                <button className="link small" onClick={() => remove(c.id)} aria-label={`Supprimer le défi ${c.title}`}>Supprimer</button>
              </div>
              <div className="progress-line"><div style={{ width: `${st.pct}%` }} /></div>
              <span className="muted small">
                {st.value} / {c.target} {kindLabel[c.kind]} · {st.done ? 'terminé' : st.expired ? 'expiré : aucune pénalité, tu peux en relancer un' : `jusqu’au ${fmtDate(c.start + c.days * 86400000)}`}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="challenge-templates">
        {CHALLENGE_TEMPLATES.map((t) => (
          <button key={t.title} className="pill" onClick={() => add(t)}>+ {t.title}</button>
        ))}
      </div>
      <form className="challenge-form" onSubmit={submit}>
        <input className="text-input" placeholder="Titre (facultatif)" maxLength={60} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        <select className="text-input" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
          <option value="answers">Réponses</option>
          <option value="days">Jours actifs</option>
          <option value="certs">Certifications</option>
        </select>
        <input className="text-input narrow" type="number" min={1} max={500} aria-label="Cible" value={draft.target} onChange={(e) => setDraft({ ...draft, target: e.target.value })} />
        <input className="text-input narrow" type="number" min={1} max={90} aria-label="Durée en jours" value={draft.days} onChange={(e) => setDraft({ ...draft, days: e.target.value })} />
        <span className="muted small">en jours</span>
        <button className="btn btn-primary" type="submit">Lancer le défi</button>
      </form>
    </>
  );
}
