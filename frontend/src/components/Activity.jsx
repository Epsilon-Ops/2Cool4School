import { useState } from 'react';
import React from 'react';

/** Normalise une réponse libre : minuscules, sans accents, sans espaces. */
export function normalize(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');
}

export default function Activity({ ex, done, onResult }) {
  switch (ex.format) {
    case 'single_choice':
      return (
        <Choice
          prompt={ex.prompt}
          items={ex.options.map((o) => ({ value: o, label: o }))}
          correct={ex.answer}
          done={done}
          onResult={onResult}
        />
      );
    case 'true_false':
      return (
        <Choice
          prompt={ex.prompt}
          statement={ex.statement}
          items={[
            { value: true, label: 'Vrai' },
            { value: false, label: 'Faux' },
          ]}
          correct={ex.isTrue}
          done={done}
          onResult={onResult}
        />
      );
    case 'flashcard':
      return <Flashcard ex={ex} done={done} onResult={onResult} />;
    case 'fill_blank':
      return <FillBlank ex={ex} done={done} onResult={onResult} />;
    case 'ordering':
      return <Ordering ex={ex} done={done} onResult={onResult} />;
    case 'matching':
      return <Matching ex={ex} done={done} onResult={onResult} />;
    default:
      return null;
  }
}

function Choice({ prompt, statement, items, correct, done, onResult }) {
  const [sel, setSel] = useState(undefined);
  return (
    <>
      <h2 className="prompt">{prompt}</h2>
      {statement !== undefined && (
        <p className="statement">
          Proposition : <em>{String(statement)}</em>
        </p>
      )}
      <div className="options">
        {items.map((it) => {
          let cls = 'option';
          if (sel === it.value) cls += ' selected';
          if (done && it.value === correct) cls += ' correct';
          if (done && sel === it.value && it.value !== correct) cls += ' wrong';
          return (
            <button key={String(it.value)} className={cls} disabled={done} onClick={() => setSel(it.value)}>
              {it.label}
            </button>
          );
        })}
      </div>
      <button className="check" disabled={done || sel === undefined} onClick={() => onResult(sel === correct)}>
        Vérifier
      </button>
    </>
  );
}

function Flashcard({ ex, done, onResult }) {
  const [shown, setShown] = useState(false);
  return (
    <>
      <h2 className="prompt">{ex.prompt}</h2>
      {!shown ? (
        <button className="check" onClick={() => setShown(true)}>
          Voir la réponse
        </button>
      ) : (
        <>
          <div className="flash-answer">{ex.answer}</div>
          {!done && (
            <div className="rate">
              <button className="hard" onClick={() => onResult(false, 1)}>Difficile</button>
              <button className="mid" onClick={() => onResult(true, 3)}>Moyen</button>
              <button className="easy" onClick={() => onResult(true, 5)}>Facile</button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function FillBlank({ ex, done, onResult }) {
  const [val, setVal] = useState('');
  const [a, b = ''] = ex.cloze.split('{{blank}}');
  const ok = normalize(val) === normalize(ex.answer);
  const submit = () => {
    if (!done && val.trim()) onResult(ok, ok ? 4 : 1);
  };
  return (
    <>
      <h2 className="prompt">{ex.prompt}</h2>
      <p className="cloze">
        {a}
        <input
          className="blank"
          value={val}
          disabled={done}
          placeholder="..."
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        {b}
      </p>
      {done && !ok && <p className="reveal">Réponse attendue : {ex.answer}</p>}
      <button className="check" disabled={done || !val.trim()} onClick={submit}>
        Vérifier
      </button>
    </>
  );
}

function Ordering({ ex, done, onResult }) {
  const [chosen, setChosen] = useState([]);
  const remaining = ex.shuffled.filter((s) => !chosen.includes(s));
  const ok = chosen.every((s, k) => s === ex.steps[k]);
  return (
    <>
      <h2 className="prompt">{ex.prompt}</h2>
      <ol className="ordered">
        {chosen.map((s, k) => {
          let cls = 'chip-step';
          if (done) cls += s === ex.steps[k] ? ' correct' : ' wrong';
          return (
            <li key={s}>
              <button className={cls} disabled={done} onClick={() => setChosen(chosen.filter((x) => x !== s))}>
                {k + 1}. {s}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="options">
        {remaining.map((s) => (
          <button key={s} className="option" disabled={done} onClick={() => setChosen([...chosen, s])}>
            {s}
          </button>
        ))}
      </div>
      <button className="check" disabled={done || chosen.length !== ex.steps.length} onClick={() => onResult(ok, ok ? 4 : 1)}>
        Vérifier
      </button>
      {done && !ok && <p className="reveal">Ordre attendu : {ex.steps.map((s, k) => `${k + 1}. ${s}`).join(' · ')}</p>}
    </>
  );
}

function Matching({ ex, done, onResult }) {
  const [leftSel, setLeftSel] = useState(null);
  const [links, setLinks] = useState({});
  const expected = Object.fromEntries(ex.pairs);
  const allLinked = ex.pairs.every(([l]) => links[l] !== undefined);
  const ok = ex.pairs.every(([l, r]) => links[l] === r);

  function pickRight(r) {
    if (done || leftSel === null) return;
    const next = {};
    for (const [k, v] of Object.entries(links)) {
      if (v !== r && k !== leftSel) next[k] = v;
    }
    next[leftSel] = r;
    setLinks(next);
    setLeftSel(null);
  }

  const usedRights = Object.values(links);

  return (
    <>
      <h2 className="prompt">{ex.prompt}</h2>
      <div className="match">
        <div className="col">
          {ex.pairs.map(([l]) => {
            let cls = 'option';
            if (leftSel === l) cls += ' selected';
            if (done) cls += links[l] === expected[l] ? ' correct' : ' wrong';
            return (
              <button key={l} className={cls} disabled={done} onClick={() => setLeftSel(l)}>
                {l}
                {links[l] && <small>→ {links[l]}</small>}
              </button>
            );
          })}
        </div>
        <div className="col">
          {ex.rights.map((r) => (
            <button
              key={r}
              className={'option' + (usedRights.includes(r) ? ' linked' : '')}
              disabled={done}
              onClick={() => pickRight(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <button className="check" disabled={done || !allLinked} onClick={() => onResult(ok, ok ? 4 : 1)}>
        Vérifier
      </button>
    </>
  );
}
