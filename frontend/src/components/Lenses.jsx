import { useState } from 'react';
import MathText from './MathText.jsx';

/** Texte d'un cours : [[notion]] devient simplement du gras (les notions cliquables restent dans l'onglet Mots). */
function Rich({ text }) {
  if (!text) return null;
  return text.split(/\[\[(.+?)\]\]/).map((part, i) =>
    i % 2 === 0 ? <MathText key={i} text={part} /> : <b key={i}><MathText text={part} /></b>,
  );
}

const paragraphs = (v) => (Array.isArray(v) ? v : v ? [v] : []);

function Missing({ label }) {
  return <p className="muted lens-missing">Le contenu « {label} » n’est pas encore rédigé pour cette section.</p>;
}

/** Résumé : contenu du cours, ou à défaut les notions à retenir. */
function Summary({ lens, section }) {
  const text = paragraphs(lens?.summary);
  if (text.length) return text.map((t, i) => <p key={i}><Rich text={t} /></p>);
  if (!section.terms?.length) return <Missing label="Résumé" />;
  return (
    <>
      <p className="muted small">Résumé généré à partir des notions de la section.</p>
      <ul className="lens-list">
        {section.terms.map((t) => (
          <li key={t.term}><b><MathText text={t.term} /></b> — <MathText text={t.def} /></li>
        ))}
      </ul>
    </>
  );
}

function Examples({ lens }) {
  const items = lens?.examples ?? [];
  if (!items.length) return <Missing label="Exemples" />;
  return (
    <ol className="lens-cards">
      {items.map((ex, i) => (
        <li key={i}>
          {ex.title && <b>{ex.title}</b>}
          <p><Rich text={ex.text} /></p>
          {ex.solution && <Reveal label="Voir la solution" text={ex.solution} />}
        </li>
      ))}
    </ol>
  );
}

/** Schéma : image vectorielle (chargée comme image, sans script) ou schéma texte. */
function Visual({ lens }) {
  const v = lens?.visual;
  if (!v) return <Missing label="Schémas" />;
  return (
    <figure className="lens-visual">
      {v.svg && <img alt={v.caption ?? 'Schéma'} src={`data:image/svg+xml;utf8,${encodeURIComponent(v.svg)}`} />}
      {v.text && <pre className="code-block">{v.text}</pre>}
      {v.caption && <figcaption>{v.caption}</figcaption>}
    </figure>
  );
}

function StepByStep({ lens }) {
  const steps = lens?.step_by_step ?? [];
  if (!steps.length) return <Missing label="Étape par étape" />;
  return (
    <ol className="lens-steps">
      {steps.map((st, i) => (
        <li key={i}>
          <b>{st.title ?? `Étape ${i + 1}`}</b>
          <p><Rich text={st.text} /></p>
        </li>
      ))}
    </ol>
  );
}

function Simplified({ lens, section }) {
  if (lens?.simplified) return paragraphs(lens.simplified).map((t, i) => <p key={i}><Rich text={t} /></p>);
  if (!section.analogies?.length) return <Missing label="Explication simplifiée" />;
  return (
    <ul className="analogies">
      {section.analogies.map((a) => (
        <li key={a.theme}><b>{a.theme}</b><span><MathText text={a.text} /></span></li>
      ))}
    </ul>
  );
}

function Detailed({ lens, section }) {
  const text = paragraphs(lens?.detailed);
  const body = text.length ? text : section.body ?? [];
  if (!body.length) return <Missing label="Explication détaillée" />;
  return body.map((t, i) => <p key={i}><Rich text={t} /></p>);
}

/** Comparaison : tableau { headers, rows }. */
function Comparison({ lens }) {
  const c = lens?.comparison;
  if (!c) return <Missing label="Comparaisons" />;
  return (
    <div className="table-scroll">
      <table className="streak-table lens-table">
        <thead><tr>{c.headers.map((h) => <th key={h}><MathText text={h} /></th>)}</tr></thead>
        <tbody>
          {c.rows.map((row, i) => (
            <tr key={i}>{row.map((cell, j) => (j === 0 ? <th key={j}><MathText text={cell} /></th> : <td key={j}><MathText text={cell} /></td>))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Mnemonics({ lens }) {
  const items = lens?.mnemonics ?? [];
  if (!items.length) return <Missing label="Moyens mnémotechniques" />;
  return (
    <ul className="lens-cards">
      {items.map((m, i) => (
        <li key={i}><b>{m.trick}</b><p><Rich text={m.text} /></p></li>
      ))}
    </ul>
  );
}

function CaseStudies({ lens }) {
  const items = lens?.case_studies ?? [];
  if (!items.length) return <Missing label="Études de cas" />;
  return (
    <ol className="lens-cards">
      {items.map((c, i) => (
        <li key={i}>
          <b>{c.title ?? `Cas ${i + 1}`}</b>
          <p><Rich text={c.situation} /></p>
          {c.question && <p className="muted"><i><Rich text={c.question} /></i></p>}
          {c.solution && <Reveal label="Voir la correction" text={c.solution} />}
        </li>
      ))}
    </ol>
  );
}

/** Reformuler : l'élève écrit avec ses mots, puis compare à un modèle. Aucune note n'est attribuée. */
function TeachBack({ lens }) {
  const [draft, setDraft] = useState('');
  const [shown, setShown] = useState(false);
  const t = lens?.teach_back;
  if (!t) return <Missing label="Reformuler avec ses mots" />;
  return (
    <div className="lens-teach">
      <p>{t.prompt}</p>
      <textarea className="write" rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Explique avec tes mots…" />
      <button className="ghost" onClick={() => setShown(true)} disabled={!draft.trim()}>Comparer avec un modèle</button>
      {shown && (
        <div className="flash-answer">
          <b>Un modèle possible :</b>
          <p><Rich text={t.model} /></p>
          <p className="muted small">Ta version n’est pas notée : compare les notions principales, puis reformule si besoin.</p>
        </div>
      )}
    </div>
  );
}

function Mistakes({ lens }) {
  const items = lens?.mistakes ?? [];
  if (!items.length) return <Missing label="Erreurs fréquentes" />;
  return (
    <ul className="lens-cards mistakes">
      {items.map((m, i) => (
        <li key={i}>
          <p><span className="fb-bad">✗ {m.wrong}</span></p>
          <p><span className="fb-ok">✓ {m.right}</span></p>
          {m.why && <p className="muted small">{m.why}</p>}
        </li>
      ))}
    </ul>
  );
}

function Reveal({ label, text }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lens-reveal">
      <button className="ghost" onClick={() => setOpen((o) => !o)}>{open ? 'Masquer' : label}</button>
      {open && <p><Rich text={text} /></p>}
    </div>
  );
}

const RENDER = {
  summary: Summary,
  examples: Examples,
  visual: Visual,
  step_by_step: StepByStep,
  simplified: Simplified,
  detailed: Detailed,
  comparison: Comparison,
  mnemonics: Mnemonics,
  case_studies: CaseStudies,
  teach_back: TeachBack,
  mistakes: Mistakes,
};

/** Affiche le contenu d'un onglet de cours. `section.lenses` porte le contenu rédigé. */
export default function Lens({ id, section }) {
  const Cmp = RENDER[id];
  if (!Cmp) return null;
  return (
    <div className="lens">
      <Cmp key={id} lens={section.lenses} section={section} />
    </div>
  );
}

export const LENS_IDS = Object.keys(RENDER);
