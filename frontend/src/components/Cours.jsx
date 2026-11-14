import { useState } from 'react';
import { courses } from '../data/utils/courseLoader.js';
import { noteKey, notionPct, sectionPct, coursePct, groupPct } from '../engine/courseProgress.js';

const CATEGORIES = [
  ['scolaire', 'Matières scolaires'],
  ['optionnelle', 'Matières optionnelles'],
  ['langue', 'Langues'],
  ['general', 'Enseignement général'],
  ['specialite', 'Enseignement de spécialité'],
  ['approfondissement', "Matières d'approfondissement"],
  ['complementaire', 'Matières complémentaires'],
  ['professionnelle', 'Enseignement professionnel'],
  ['interdisciplinaire', 'Enseignement interdisciplinaire'],
];

const TABS = [
  ['analogies', 'Analogies'],
  ['terms', 'Mots & formules'],
  ['practice', 'S’exercer'],
  ['summary', 'Résumé du cours'],
  ['examples', 'Exemples'],
  ['visual', 'Schémas'],
  ['step_by_step', 'Explication étape par étape'],
  ['simplified', 'Explication simplifiée'],
  ['detailed', 'Explication détaillée'],
  ['comparison', 'Comparaisons'],
  ['mnemonics', 'Moyens mnémotechniques'],
  ['case_studies', 'Études de cas'],
  ['teach_back', 'Reformuler avec ses mots'],
  ['mistakes', 'Erreurs fréquentes'],
];

/** Barre de progression avec pourcentage. */
function Bar({ pct }) {
  return (
    <span className="bar-wrap">
      <span className="bar"><span style={{ width: `${pct}%` }} /></span>
      <b className="pct">{pct} %</b>
    </span>
  );
}

/** Arbre catégorie → matière → chapitre → cours. Seuls les cours avec du contenu sont listés. */
export function buildTree(subjects) {
  const ready = courses.filter((c) => c.sections?.length > 0);
  return CATEGORIES.map(([cat, label]) => ({
    cat,
    label,
    subjects: subjects
      .filter((s) => (s.category ?? 'scolaire') === cat)
      .map((sub) => {
        const own = ready.filter((c) => c.subject === sub.id);
        const byChapter = {};
        for (const c of own) {
          const key = c.chapter ?? 'Sans chapitre';
          (byChapter[key] ??= { title: key, order: c.chapterOrder ?? 99, courses: [] }).courses.push(c);
        }
        const chapters = Object.values(byChapter)
          .sort((a, b) => a.order - b.order)
          .map((ch) => ({ ...ch, courses: ch.courses.sort((a, b) => (a.order ?? 99) - (b.order ?? 99)) }));
        return { ...sub, chapters, courses: own };
      })
      .filter((s) => s.courses.length > 0),
  })).filter((c) => c.subjects.length > 0);
}

/** Paragraphe : les notions définies entre [[ ]] sont cliquables ; les autres restent du texte. */
function Body({ text, terms, onTerm }) {
  return text.split(/\[\[(.+?)\]\]/).map((part, i) => {
    if (i % 2 === 0) return <span key={i}>{part}</span>;
    const defined = terms.some((t) => t.term === part);
    return defined ? (
      <button key={i} className="key" onClick={() => onTerm(part)}>{part}</button>
    ) : (
      <span key={i}>{part}</span>
    );
  });
}

function Section({ course, section, index, open, onToggle, onPractice, progress, onSeen }) {
  const [tab, setTab] = useState('analogies');
  const [focus, setFocus] = useState(null);
  const count = section.questionIds?.length ?? 0;
  const [n, setN] = useState(Math.min(5, count));
  const pct = sectionPct(course.id, section, progress);

  const seeTerm = (term) => onSeen(course.id, noteKey(section.id, term));
  const pickTerm = (term) => {
    setFocus(term);
    setTab('terms');
    seeTerm(term);
  };

  return (
    <article className={`lesson-sec${open ? ' open' : ''}`}>
      <button className="lesson-head" aria-expanded={open} onClick={onToggle}>
        <span className="num">{index + 1}</span>
        <span className="lesson-title">{section.title}</span>
        <Bar pct={pct} />
        <span className="chev" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="lesson-body">
          {section.body.map((p, i) => (
            <p key={i}>
              <Body text={p} terms={section.terms ?? []} onTerm={pickTerm} />
            </p>
          ))}

          <div className="lesson-tabs" role="tablist">
            {TABS.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'analogies' && (
            <ul className="analogies">
              {section.analogies.map((a) => (
                <li key={a.theme}>
                  <b>{a.theme}</b>
                  <span>{a.text}</span>
                </li>
              ))}
            </ul>
          )}

          {tab === 'terms' && (
            <dl className="terms">
              {section.terms.map((t) => {
                const seen = notionPct(course.id, section.id, t.term, progress) === 100;
                return (
                  <div key={t.term} className={focus === t.term ? 'focus' : ''}>
                    <button className="term-btn" onClick={() => seeTerm(t.term)}>
                      <dt>
                        {t.term}
                        {t.formula && <code>{t.formula}</code>}
                      </dt>
                      <span className={`tag ${seen ? 'ok' : ''}`}>{seen ? 'Vue · 100 %' : 'À voir · 0 %'}</span>
                    </button>
                    <dd>{t.def}</dd>
                  </div>
                );
              })}
            </dl>
          )}

          {tab === 'practice' && (
            <div className="lesson-practice">
              <p className="muted">{count} question{count > 1 ? 's' : ''} liée{count > 1 ? 's' : ''} à cette section, sans indication de matière.</p>
              <label className="count-pick">
                Nombre de questions
                <select value={n} onChange={(e) => setN(Number(e.target.value))} disabled={!count}>
                  {Array.from({ length: count }, (_, i) => i + 1).map((k) => (
                    <option key={k} value={k}>{k} / {count}</option>
                  ))}
                </select>
              </label>
              <button className="btn btn-primary" disabled={!count} onClick={() => onPractice(section, n)}>
                S’exercer sur {n} question{n > 1 ? 's' : ''}
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/** Un cours ouvert : progression globale puis sous-sections dépliables. */
function CourseView({ course, progress, onBack, onPractice, onSeen }) {
  const [openId, setOpenId] = useState(null);
  return (
    <div className="cours">
      <button className="pill back" onClick={onBack}>← Tous les cours</button>
      <section className="hero">
        <div className="hero-main">
          <span className="eyebrow">{course.subjectName} · {course.chapter}</span>
          <h1>{course.title}</h1>
          <p className="muted">{course.intro}</p>
          <Bar pct={coursePct(course, progress)} />
        </div>
      </section>
      <div className="lesson-list">
        {course.sections.map((s, i) => (
          <Section
            key={s.id}
            course={course}
            section={s}
            index={i}
            open={openId === s.id}
            onToggle={() => setOpenId(openId === s.id ? null : s.id)}
            onPractice={onPractice}
            progress={progress}
            onSeen={onSeen}
          />
        ))}
      </div>
    </div>
  );
}

/** Vue « Cours » : catégories, matières, chapitres, cours, avec progression à chaque niveau. */
export default function Cours({ subjects, progress, onSeen, onPractice }) {
  const [openCourse, setOpenCourse] = useState(null);
  const tree = buildTree(subjects);

  if (openCourse) {
    const course = courses.find((c) => c.id === openCourse);
    if (course) {
      return <CourseView course={course} progress={progress} onBack={() => setOpenCourse(null)} onPractice={onPractice} onSeen={onSeen} />;
    }
  }

  if (tree.length === 0) return <p className="muted">Aucun cours disponible pour le moment.</p>;

  return (
    <div className="cours">
      {tree.map((cat) => (
        <section key={cat.cat} className="cours-cat">
          <h2 className="cat-title">{cat.label}</h2>
          {cat.subjects.map((sub) => (
            <details key={sub.id} className="subject-block" open style={{ '--c': sub.color }}>
              <summary>
                <span>{sub.emoji} {sub.name}</span>
                <Bar pct={groupPct(sub.courses, progress)} />
              </summary>
              {sub.chapters.map((ch) => (
                <div key={ch.title} className="chapter">
                  <h3>{ch.title} <Bar pct={groupPct(ch.courses, progress)} /></h3>
                  <ul className="course-cards">
                    {ch.courses.map((c) => (
                      <li key={c.id}>
                        <button className="course-card" onClick={() => setOpenCourse(c.id)}>
                          <b>{c.title}</b>
                          <Bar pct={coursePct(c, progress)} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </details>
          ))}
        </section>
      ))}
    </div>
  );
}
