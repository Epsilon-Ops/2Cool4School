import { useState } from 'react';
import { courses } from '../data/courseLoader.js';

const CATEGORIES = [
  ['scolaire', 'Matières scolaires'],
  ['optionnelle', 'Matières optionnelles'],
];

const TABS = [
  ['analogies', 'Analogies'],
  ['terms', 'Mots & formules'],
  ['practice', 'S’exercer'],
];

/** Arbre catégorie → matière → chapitre → cours. Les niveaux vides sont masqués. */
export function buildTree(subjects) {
  return CATEGORIES.map(([cat, label]) => ({
    cat,
    label,
    subjects: subjects
      .filter((s) => (s.category ?? 'scolaire') === cat)
      .map((sub) => {
        const own = courses.filter((c) => c.subject === sub.id);
        const byChapter = {};
        for (const c of own) {
          const key = c.chapter ?? 'Sans chapitre';
          (byChapter[key] ??= { title: key, order: c.chapterOrder ?? 99, courses: [] }).courses.push(c);
        }
        const chapters = Object.values(byChapter)
          .sort((a, b) => a.order - b.order)
          .map((ch) => ({ ...ch, courses: ch.courses.sort((a, b) => (a.order ?? 99) - (b.order ?? 99)) }));
        return { ...sub, chapters, count: own.length };
      })
      .filter((s) => s.count > 0),
  })).filter((c) => c.subjects.length > 0);
}

/** Texte d'un paragraphe : les notions entre [[ ]] sont mises en évidence et cliquables. */
function Body({ text, onTerm }) {
  return text.split(/\[\[(.+?)\]\]/).map((part, i) =>
    i % 2 === 0 ? (
      <span key={i}>{part}</span>
    ) : (
      <button key={i} className="key" onClick={() => onTerm(part)}>{part}</button>
    )
  );
}

function Section({ section, index, open, onToggle, onPractice }) {
  const [tab, setTab] = useState('analogies');
  const [focus, setFocus] = useState(null);
  const count = section.questionIds?.length ?? 0;

  const pickTerm = (term) => {
    setFocus(term);
    setTab('terms');
  };

  return (
    <article className={`lesson-sec${open ? ' open' : ''}`}>
      <button className="lesson-head" aria-expanded={open} onClick={onToggle}>
        <span className="num">{index + 1}</span>
        <span className="lesson-title">{section.title}</span>
        <span className="chev" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="lesson-body">
          {section.body.map((p, i) => (
            <p key={i}>
              <Body text={p} onTerm={pickTerm} />
            </p>
          ))}

          <div className="lesson-tabs" role="tablist">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                className={tab === id ? 'on' : ''}
                onClick={() => setTab(id)}
              >
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
              {section.terms.map((t) => (
                <div key={t.term} className={focus === t.term ? 'focus' : ''}>
                  <dt>
                    {t.term}
                    {t.formula && <code>{t.formula}</code>}
                  </dt>
                  <dd>{t.def}</dd>
                </div>
              ))}
            </dl>
          )}

          {tab === 'practice' && (
            <div className="lesson-practice">
              <p className="muted">
                {count} question{count > 1 ? 's' : ''} liée{count > 1 ? 's' : ''} à cette section, posée{count > 1 ? 's' : ''} sans indication de matière.
              </p>
              <button className="btn btn-primary" disabled={!count} onClick={() => onPractice(section)}>
                S’exercer sur cette section
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/** Un cours ouvert : sections dépliables. */
function CourseView({ course, onBack, onPractice }) {
  const [openId, setOpenId] = useState(null);
  return (
    <div className="cours">
      <button className="pill back" onClick={onBack}>← Tous les cours</button>
      <section className="hero">
        <div className="hero-main">
          <span className="eyebrow">{course.subjectName} · {course.chapter}</span>
          <h1>{course.title}</h1>
          <p className="muted">{course.intro}</p>
        </div>
      </section>
      <div className="lesson-list">
        {course.sections.map((s, i) => (
          <Section
            key={s.id}
            section={s}
            index={i}
            open={openId === s.id}
            onToggle={() => setOpenId(openId === s.id ? null : s.id)}
            onPractice={onPractice}
          />
        ))}
      </div>
    </div>
  );
}

/** Vue « Cours » : catégories, puis matières, puis chapitres, puis cours. */
export default function Cours({ subjects, onPractice }) {
  const [openCourse, setOpenCourse] = useState(null);
  const tree = buildTree(subjects);

  if (openCourse) {
    const course = courses.find((c) => c.id === openCourse);
    if (course) return <CourseView course={course} onBack={() => setOpenCourse(null)} onPractice={onPractice} />;
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
                <span className="unit-code">{sub.code}</span>
              </summary>
              {sub.chapters.map((ch) => (
                <div key={ch.title} className="chapter">
                  <h3>{ch.title}</h3>
                  <ul className="course-cards">
                    {ch.courses.map((c) => (
                      <li key={c.id}>
                        <button className="course-card" onClick={() => setOpenCourse(c.id)}>
                          <b>{c.title}</b>
                          <span className="muted">{c.sections.length} sections</span>
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
