import { Fragment, useEffect, useRef, useState } from 'react';
import { parseValue, normalize } from '../engine/grading.js';
import MathText from './MathText.jsx';

// Compatibilité : `normalize` était défini ici avant d'être déplacé dans engine/grading.js.
export { normalize };

/**
 * Affiche un exercice selon sa vue (champ `view`, défini par le registre de formats).
 * La correction passe par `ex.check(valeur)` → { ok, items }. Les items sont affichés après validation.
 * `onResult(ok, qualité)` est appelé une seule fois, quand l'élève valide ou s'auto-évalue.
 */
export default function Activity({ ex, done, onResult }) {
  switch (ex.view) {
    case 'choice':
      return (
        <Choice
          prompt={ex.prompt}
          statement={ex.statement}
          passage={ex.passage}
          passageLabel={ex.format === 'reading_comprehension' ? 'Texte' : 'Contexte'}
          choices={ex.choices}
          correct={ex.correct}
          why={ex.why}
          done={done}
          onResult={onResult}
        />
      );
    case 'multi':
      return <MultiChoice ex={ex} done={done} onResult={onResult} />;
    case 'self':
      return <SelfCheck ex={ex} done={done} onResult={onResult} />;
    case 'numeric':
      return <NumericInput ex={ex} done={done} onResult={onResult} />;
    case 'text':
      return <TextInput ex={ex} done={done} onResult={onResult} />;
    case 'justify':
      return <JustifyInput ex={ex} done={done} onResult={onResult} />;
    case 'parts':
      return <Parts ex={ex} done={done} onResult={onResult} />;
    case 'cloze':
      return <Cloze ex={ex} done={done} onResult={onResult} />;
    case 'ordering':
      return <Ordering ex={ex} done={done} onResult={onResult} />;
    case 'matching':
      return <Matching ex={ex} done={done} onResult={onResult} />;
    case 'table':
      return <Table ex={ex} done={done} onResult={onResult} />;
    case 'speak':
      return <Speak ex={ex} done={done} onResult={onResult} />;
    case 'turns':
      return <Turns ex={ex} done={done} onResult={onResult} />;
    default:
      return null;
  }
}

// ---------- Éléments communs ----------

function Prompt({ text }) {
  return text ? (
    <h2 className="prompt">
      <MathText text={text} />
    </h2>
  ) : null;
}

/** Bloc d'information (texte, contexte, formule, phrase à dire). */
function Block({ label, children }) {
  return (
    <div className="passage">
      <span>{label}</span>
      <div>
        <MathText text={String(children)} />
      </div>
    </div>
  );
}

function Code({ children }) {
  return <pre className="code-block">{children}</pre>;
}

/**
 * Retours sur la réponse : phrases colorées, listes, et comparaison mot à mot ou ligne à ligne.
 * Ne s'affiche qu'une fois la réponse validée.
 */
function Feedback({ items }) {
  if (!items?.length) return null;
  return (
    <div className="feedback-list" role="status">
      {items.map((it, i) => {
        if (it.t === 'diff') {
          return (
            <div key={i} className="fb-diff">
              <span>{it.title}</span>
              <p>
                {it.items.length === 0 && <em>Aucune différence.</em>}
                {it.items.map((d, k) => (
                  <code key={k} className={`fb-${d.k}`}>
                    {d.k === 'del' ? '− ' : d.k === 'add' ? '+ ' : ''}
                    {d.w}
                  </code>
                ))}
              </p>
            </div>
          );
        }
        if (it.t === 'list') {
          return (
            <div key={i} className={`fb-list ${it.tone ?? 'warn'}`}>
              <span>{it.title}</span>
              <ul>
                {it.items.map((x, k) => (
                  <li key={k}>
                    <MathText text={x} />
                  </li>
                ))}
              </ul>
            </div>
          );
        }
        return (
          <p key={i} className={`fb-${it.t}`}>
            <MathText text={it.text} />
          </p>
        );
      })}
    </div>
  );
}

/** Valide une réponse : appelle la correction de l'exercice, puis informe le parent. */
function useValidate(ex, onResult) {
  const [res, setRes] = useState([]);
  const run = (value) => {
    const r = ex.check ? ex.check(value) : { ok: ex.judge(value), items: [] };
    setRes(r.items ?? []);
    onResult(r.ok, r.ok ? 4 : 1);
    return r;
  };
  return [res, run];
}

function Rate({ onResult, suggested }) {
  const options = [
    ['hard', 'Raté', 1, false],
    ['mid', 'Presque', 3, true],
    ['easy', 'Compris', 5, true],
  ];
  return (
    <div className="rate">
      {options.map(([cls, label, q, ok]) => (
        <button key={cls} className={`${cls} ${suggested === q ? 'suggested' : ''}`} onClick={() => onResult(ok, q, false)}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** Lecture à voix haute (synthèse vocale du navigateur, si elle existe). */
export function speak(text, lang = 'fr-FR') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new window.SpeechSynthesisUtterance(String(text));
  u.lang = lang;
  window.speechSynthesis.speak(u);
}

function AudioButton({ audio, label = '🔊 Écouter' }) {
  if (!audio) return null;
  return (
    <button type="button" className="audio-btn" onClick={() => speak(audio.text, audio.lang)}>
      {label}
    </button>
  );
}

// ---------- Choix ----------

function Choice({ prompt, statement, passage, passageLabel, choices, correct, why, done, onResult }) {
  const [sel, setSel] = useState(undefined);
  const explain = done && sel !== undefined && sel !== correct ? why?.[String(sel)] : null;
  return (
    <>
      <Prompt text={prompt} />
      {passage && <Block label={passageLabel}>{passage}</Block>}
      {statement !== undefined && (
        <p className="statement">
          <span>Proposition</span>
          <strong>
            <MathText text={String(statement)} />
          </strong>
        </p>
      )}
      <div className={`options ${choices.length === 2 ? 'two' : ''}`}>
        {choices.map((it) => {
          let cls = 'option';
          if (!done && sel === it.value) cls += ' selected';
          if (done && it.value === correct) cls += ' correct';
          if (done && sel === it.value && it.value !== correct) cls += ' wrong';
          return (
            <button key={String(it.value)} className={cls} disabled={done} onClick={() => setSel(it.value)}>
              <MathText text={String(it.label)} />
            </button>
          );
        })}
      </div>
      {explain && <Feedback items={[{ t: 'warn', text: explain }]} />}
      <button
        className="check"
        disabled={done || sel === undefined}
        onClick={() => onResult(sel === correct)}
      >
        Vérifier
      </button>
    </>
  );
}

/** Plusieurs bonnes réponses : le retour indique combien sont trouvées et lesquelles sont fausses. */
function MultiChoice({ ex, done, onResult }) {
  const [sel, setSel] = useState([]);
  const [res, run] = useValidate(ex, onResult);
  const good = new Set(ex.answers);
  const toggle = (v) => setSel((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));
  return (
    <>
      <Prompt text={ex.prompt} />
      <p className="hint">Plusieurs réponses peuvent être correctes.</p>
      <div className="options">
        {ex.options.map((o) => {
          let cls = 'option';
          if (!done && sel.includes(o)) cls += ' selected';
          if (done && good.has(o)) cls += ' correct';
          if (done && sel.includes(o) && !good.has(o)) cls += ' wrong';
          return (
            <button key={o} className={cls} disabled={done} aria-pressed={sel.includes(o)} onClick={() => toggle(o)}>
              <MathText text={o} />
            </button>
          );
        })}
      </div>
      <Feedback items={done ? res : []} />
      <button className="check" disabled={done || sel.length === 0} onClick={() => run(sel)}>
        Vérifier
      </button>
    </>
  );
}

// ---------- Auto-évaluation : rédaction, code, cartes ----------

/** Tableau de données figé (lecture seule), pour les exercices d'interprétation. */
function StaticTable({ rows }) {
  return (
    <div className="grid-wrap">
      <table className="grid-table">
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) =>
                i === 0 || j === 0 ? (
                  <th key={j}>
                    <MathText text={String(cell)} />
                  </th>
                ) : (
                  <td key={j}>
                    <MathText text={String(cell)} />
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Rédaction, code ou carte à retourner.
 * - L'élève écrit (si l'exercice le demande), puis affiche le corrigé.
 * - La grille (`checklist`) liste les notions à avoir. Les notions testables sont cochées sur le brouillon
 *   (« Vérifier mes notions »), l'élève peut corriger à la main.
 * - La note suggérée est calculée à partir de la grille : tout coché → Compris, la moitié → Presque, sinon Raté.
 */
function SelfCheck({ ex, done, onResult }) {
  const sections = ex.sections ?? null;
  const write = ex.write !== false;
  const mono = Boolean(ex.mono);
  const checklist = ex.checklist ?? [];
  const [drafts, setDrafts] = useState(() => (sections ? sections.map(() => '') : ['']));
  const [shown, setShown] = useState(false);
  const [ticks, setTicks] = useState(() => checklist.map(() => false));
  const [autoRan, setAutoRan] = useState(false);
  const setDraft = (k, v) => setDrafts((d) => d.map((x, i) => (i === k ? v : x)));

  const textFor = (it) => (sections && it.sec != null ? drafts[it.sec] ?? '' : drafts.join('\n'));
  const runAuto = () => {
    setTicks(checklist.map((it, i) => (it.test ? it.test(textFor(it)) : ticks[i])));
    setAutoRan(true);
  };
  const toggle = (i) => setTicks((t) => t.map((x, k) => (k === i ? !x : x)));

  const total = checklist.length;
  const got = ticks.filter(Boolean).length;
  const ratio = total ? got / total : null;
  const suggested = ratio === null ? null : ratio >= 0.999 ? 5 : ratio >= 0.5 ? 3 : 1;
  const hasAuto = checklist.some((it) => it.test);
  const gridVisible = total > 0 && (shown || autoRan);

  return (
    <>
      <Prompt text={ex.prompt} />
      {ex.passage && <Block label={ex.passageLabel ?? 'Document'}>{ex.passage}</Block>}
      {ex.code && <Code>{ex.code}</Code>}
      {ex.data && <StaticTable rows={ex.data} />}

      {write &&
        (sections ? (
          sections.map((s, k) => (
            <label key={k} className="section-write">
              <span>{s.label}</span>
              <textarea
                className={`write ${mono ? 'mono' : ''}`}
                rows={4}
                value={drafts[k]}
                disabled={done}
                placeholder="Ta rédaction…"
                onChange={(e) => setDraft(k, e.target.value)}
              />
            </label>
          ))
        ) : (
          <textarea
            className={`write ${mono ? 'mono' : ''}`}
            rows={mono ? 6 : 4}
            value={drafts[0]}
            disabled={done}
            placeholder={mono ? 'Ton code…' : 'Ta rédaction…'}
            onChange={(e) => setDraft(0, e.target.value)}
          />
        ))}

      {!shown ? (
        <div className="row-actions">
          {hasAuto && write && (
            <button className="ghost" disabled={done} onClick={runAuto}>
              Vérifier mes notions
            </button>
          )}
          <button className="check" onClick={() => setShown(true)}>
            {ex.revealLabel ?? 'Voir le corrigé'}
          </button>
        </div>
      ) : (
        <>
          {sections ? (
            sections.map((s, k) => (
              <div key={k} className="model">
                <span>{s.label}</span>
                {mono ? <Code>{s.model}</Code> : <div className="flash-answer"><MathText text={s.model} /></div>}
              </div>
            ))
          ) : mono ? (
            <Code>{ex.answer}</Code>
          ) : (
            <div className="flash-answer">
              <MathText text={ex.answer} />
            </div>
          )}
          {ex.diffItems?.length > 0 && (
            <div className="fb-diff">
              <span>Ce qui change dans la correction</span>
              <p>
                {ex.diffItems.map((d, k) => (
                  <code key={k} className={`fb-${d.k}`}>
                    {d.k === 'del' ? '− ' : '+ '}
                    {d.w}
                  </code>
                ))}
              </p>
            </div>
          )}
        </>
      )}

      {gridVisible && (
        <div className="checklist">
          <span>Grille d’auto-évaluation</span>
          <ul>
            {checklist.map((it, i) => (
              <li key={i} className={ticks[i] ? 'on' : ''}>
                <label>
                  <input type="checkbox" checked={ticks[i]} disabled={done} onChange={() => toggle(i)} />
                  <MathText text={it.label} />
                  {sections && it.sec != null && <em> · {sections[it.sec].label}</em>}
                  {it.test && <small>auto</small>}
                </label>
              </li>
            ))}
          </ul>
          <p className="score">
            {got}/{total} critères remplis
            {suggested !== null && shown && (
              <> · suggestion : {suggested === 5 ? 'Compris' : suggested === 3 ? 'Presque' : 'Raté'}</>
            )}
          </p>
        </div>
      )}

      {shown && !done && <Rate suggested={suggested} onResult={onResult} />}
    </>
  );
}

// ---------- Saisie ----------

/** Calcul : grandeur saisie (nombre, fraction, unité). Le retour explique le problème d'unité ou de valeur. */
function NumericInput({ ex, done, onResult }) {
  const [val, setVal] = useState('');
  const [res, run] = useValidate(ex, onResult);
  const submit = () => {
    if (done || !val.trim()) return;
    run(val);
  };
  return (
    <>
      <Prompt text={ex.prompt} />
      {ex.formula && <Block label="Formule">{ex.formula}</Block>}
      <p className="cloze">
        <input
          className="blank"
          inputMode="decimal"
          value={val}
          disabled={done}
          placeholder={ex.unit ? `valeur ${ex.unit}` : '…'}
          autoFocus
          aria-label="Votre réponse"
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        {ex.unit && <span className="unit">{ex.unit}</span>}
      </p>
      {ex.hint && <p className="hint">{ex.hint}</p>}
      <Feedback items={done ? res : []} />
      <button className="check" disabled={done || !val.trim()} onClick={submit}>
        Vérifier
      </button>
    </>
  );
}

/** Réponse écrite courte : texte, formule, code ou sortie de programme. */
function TextInput({ ex, done, onResult }) {
  const [val, setVal] = useState('');
  const [res, run] = useValidate(ex, onResult);
  const submit = () => {
    if (done || !val.trim()) return;
    run(val);
  };
  const common = {
    value: val,
    disabled: done,
    placeholder: ex.placeholder ?? '…',
    autoFocus: true,
    'aria-label': 'Votre réponse',
    className: `text-answer ${ex.mono ? 'mono' : ''}`,
    onChange: (e) => setVal(e.target.value),
  };
  return (
    <>
      <Prompt text={ex.prompt} />
      {ex.code && <Code>{ex.code}</Code>}
      <AudioButton audio={ex.audio} />
      {ex.multiline ? (
        <textarea rows={6} {...common} />
      ) : (
        <input type="text" {...common} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      )}
      {ex.hint && <p className="hint">{ex.hint}</p>}
      {ex.checklist?.length > 0 && !done && (
        <p className="hint">Tu seras évalué sur {ex.checklist.length} notion{ex.checklist.length > 1 ? 's' : ''}.</p>
      )}
      <Feedback items={done ? res : []} />
      {done && ex.reveal && <p className="expected-line">Réponse attendue : <MathText text={ex.reveal} /></p>}
      <button className="check" disabled={done || !val.trim()} onClick={submit}>
        Vérifier
      </button>
    </>
  );
}

/** Deux champs : la réponse, puis sa justification. Les deux sont corrigés ensemble. */
function JustifyInput({ ex, done, onResult }) {
  const [answer, setAnswer] = useState('');
  const [just, setJust] = useState('');
  const [res, run] = useValidate(ex, onResult);
  const ready = answer.trim() && just.trim();
  const submit = () => {
    if (done || !ready) return;
    run({ answer, justification: just });
  };
  return (
    <>
      <Prompt text={ex.prompt} />
      <label className="section-write">
        <span>{ex.answerLabel}</span>
        <input
          className="text-answer"
          value={answer}
          disabled={done}
          placeholder="Ta réponse"
          onChange={(e) => setAnswer(e.target.value)}
        />
      </label>
      <label className="section-write">
        <span>{ex.justifyLabel}</span>
        <textarea
          className="write"
          rows={4}
          value={just}
          disabled={done}
          placeholder="Explique pourquoi (règle, propriété, raisonnement)…"
          onChange={(e) => setJust(e.target.value)}
        />
      </label>
      {ex.checklist?.length > 0 && !done && (
        <p className="hint">La justification est évaluée sur {ex.checklist.length} notion{ex.checklist.length > 1 ? 's' : ''}.</p>
      )}
      <Feedback items={done ? res : []} />
      <button className="check" disabled={done || !ready} onClick={submit}>
        Vérifier
      </button>
    </>
  );
}

/** Plusieurs réponses courtes, une par ligne. Le retour indique le score et les parties fausses. */
function Parts({ ex, done, onResult }) {
  const [vals, setVals] = useState(() => ex.parts.map(() => ''));
  const [res, run] = useValidate(ex, onResult);
  const complete = vals.every((v) => v.trim() !== '');
  const setVal = (i, v) => setVals((a) => a.map((x, k) => (k === i ? v : x)));
  const submit = () => {
    if (done || !complete) return;
    run(vals);
  };
  const results = done ? ex.parts.map((_, i) => ex.checkPart(i, vals[i])) : [];
  return (
    <>
      <Prompt text={ex.prompt} />
      {ex.formula && <Block label="Formule">{ex.formula}</Block>}
      {ex.code && <Code>{ex.code}</Code>}
      {ex.hint && <p className="hint">{ex.hint}</p>}
      <div className="parts">
        {ex.parts.map((p, i) => {
          const right = done ? results[i] : null;
          return (
            <div key={i} className={`part-row ${done ? (right ? 'ok' : 'ko') : ''}`}>
              <span className="part-label">
                <MathText text={p.label} />
              </span>
              {p.kind === 'bit' ? (
                <span className="bits">
                  {['0', '1'].map((b) => (
                    <button
                      key={b}
                      type="button"
                      className={`bit ${vals[i] === b ? 'on' : ''}`}
                      disabled={done}
                      onClick={() => setVal(i, b)}
                    >
                      {b}
                    </button>
                  ))}
                </span>
              ) : (
                <input
                  className="part-input"
                  value={vals[i]}
                  disabled={done}
                  inputMode={p.kind === 'number' ? 'decimal' : 'text'}
                  placeholder="…"
                  aria-label={p.label || 'Réponse'}
                  onChange={(e) => setVal(i, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                />
              )}
              {done && !right && (
                <small className="expected">
                  Attendu : <MathText text={p.answer} />
                </small>
              )}
            </div>
          );
        })}
      </div>
      <Feedback items={done ? res : []} />
      {done && ex.figure && <FigureSvg points={ex.figure} />}
      <button className="check" disabled={done || !complete} onClick={submit}>
        Vérifier
      </button>
    </>
  );
}

/** Dessin d'une figure à partir de ses sommets (repère orthonormé, y vers le haut). */
function FigureSvg({ points }) {
  const names = Object.keys(points);
  const xs = names.map((n) => points[n][0]);
  const ys = names.map((n) => points[n][1]);
  const minX = Math.min(...xs) - 1;
  const maxX = Math.max(...xs) + 1;
  const minY = Math.min(...ys) - 1;
  const maxY = Math.max(...ys) + 1;
  const w = maxX - minX;
  const h = maxY - minY;
  return (
    <svg className="figure" viewBox={`${minX} ${-maxY} ${w} ${h}`} role="img" aria-label="Figure">
      <polygon points={names.map((n) => `${points[n][0]},${-points[n][1]}`).join(' ')} />
      {names.map((n) => (
        <g key={n}>
          <circle cx={points[n][0]} cy={-points[n][1]} r={w / 90} />
          <text x={points[n][0] + w / 40} y={-points[n][1] - h / 40} fontSize={w / 22}>
            {n}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Texte à trous, un ou plusieurs trous, sur une ou plusieurs lignes. `mono` pour le code. */
function Cloze({ ex, done, onResult }) {
  const [vals, setVals] = useState(() => ex.blanks.map(() => ''));
  const [res, run] = useValidate(ex, onResult);
  const complete = vals.every((v) => v.trim() !== '');
  const submit = () => {
    if (done || !complete) return;
    run(vals);
  };
  // Découpe chaque ligne autour des trous, en numérotant les trous de façon continue.
  let k = 0;
  const lines = ex.cloze.split('\n').map((line) => {
    const segs = line.split('{{blank}}');
    const start = k;
    k += segs.length - 1;
    return { segs, start };
  });
  return (
    <>
      <Prompt text={ex.prompt} />
      <div className={`cloze ${ex.mono ? 'mono' : ''}`}>
        {lines.map(({ segs, start }, li) => (
          <div key={li} className="cloze-line">
            {segs.map((seg, i) => (
              <Fragment key={i}>
                {seg && (ex.mono ? <span>{seg}</span> : <MathText text={seg} />)}
                {i < segs.length - 1 && (
                  <input
                    className="blank"
                    value={vals[start + i]}
                    disabled={done}
                    placeholder="…"
                    aria-label={`Trou ${start + i + 1}`}
                    autoFocus={start + i === 0}
                    onChange={(e) => {
                      const v = e.target.value;
                      setVals((a) => a.map((x, j) => (j === start + i ? v : x)));
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && submit()}
                  />
                )}
              </Fragment>
            ))}
          </div>
        ))}
      </div>
      {ex.hint && <p className="hint">{ex.hint}</p>}
      <Feedback items={done ? res : []} />
      <button className="check" disabled={done || !complete} onClick={submit}>
        Vérifier
      </button>
    </>
  );
}

/** Tableau à compléter : les cases « ? » sont saisies, les autres sont données. */
function Table({ ex, done, onResult }) {
  const [vals, setVals] = useState({});
  const [res, run] = useValidate(ex, onResult);
  const key = (i, j) => `${i},${j}`;
  const blankKeys = new Set(ex.blanks.map(([i, j]) => key(i, j)));
  const complete = ex.blanks.every(([i, j]) => (vals[key(i, j)] ?? '').trim() !== '');
  const submit = () => {
    if (done || !complete) return;
    run(vals);
  };
  const wrongCells = done
    ? new Set(ex.blanks.filter(([i, j]) => !ex.checkCell(i, j, vals[key(i, j)] ?? '')).map(([i, j]) => key(i, j)))
    : new Set();
  return (
    <>
      <Prompt text={ex.prompt} />
      {ex.code && <Code>{ex.code}</Code>}
      <div className="grid-wrap">
        <table className="grid-table">
          <tbody>
            {ex.table.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => {
                  const k = key(i, j);
                  if (!blankKeys.has(k)) {
                    return i === 0 || j === 0 ? (
                      <th key={j}>
                        <MathText text={cell} />
                      </th>
                    ) : (
                      <td key={j}>
                        <MathText text={cell} />
                      </td>
                    );
                  }
                  const wrong = done && wrongCells.has(k);
                  return (
                    <td key={j} className={done ? (wrong ? 'cell-ko' : 'cell-ok') : ''}>
                      <input
                        className="cell-input"
                        value={vals[k] ?? ''}
                        disabled={done}
                        aria-label={`Ligne ${i + 1}, colonne ${j + 1}`}
                        onChange={(e) => {
                          const v = e.target.value;
                          setVals((a) => ({ ...a, [k]: v }));
                        }}
                      />
                      {wrong && <small>{ex.expected[i][j]}</small>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ex.hint && <p className="hint">{ex.hint}</p>}
      <Feedback items={done ? res : []} />
      <button className="check" disabled={done || !complete} onClick={submit}>
        Vérifier
      </button>
    </>
  );
}

// ---------- Ordre et association ----------

/** Remettre dans l'ordre. On travaille avec les indices, pour gérer les étapes identiques. */
function Ordering({ ex, done, onResult }) {
  const [chosen, setChosen] = useState([]);
  const [res, run] = useValidate(ex, onResult);
  const remaining = ex.shuffled.map((_, i) => i).filter((i) => !chosen.includes(i));
  return (
    <>
      <Prompt text={ex.prompt} />
      <ol className="ordered">
        {chosen.map((ix, k) => {
          let cls = 'chip-step';
          if (done) cls += ex.shuffled[ix] === ex.steps[k] ? ' correct' : ' wrong';
          return (
            <li key={ix}>
              <button className={cls} disabled={done} onClick={() => setChosen(chosen.filter((x) => x !== ix))}>
                <b>{k + 1}</b> <MathText text={ex.shuffled[ix]} />
              </button>
            </li>
          );
        })}
      </ol>
      {!done && chosen.length < ex.steps.length && (
        <p className="hint">Touche une étape pour la sélectionner dans l'ordre.</p>
      )}
      <div className="options">
        {remaining.map((ix) => (
          <button key={ix} className="option" disabled={done} onClick={() => setChosen([...chosen, ix])}>
            <MathText text={ex.shuffled[ix]} />
          </button>
        ))}
      </div>
      <Feedback items={done ? res : []} />
      <button className="check" disabled={done || chosen.length !== ex.steps.length} onClick={() => run(chosen)}>
        Vérifier
      </button>
    </>
  );
}

function Matching({ ex, done, onResult }) {
  const [leftSel, setLeftSel] = useState(null);
  const [links, setLinks] = useState({});
  const [res, run] = useValidate(ex, onResult);
  const expected = Object.fromEntries(ex.pairs);
  const allLinked = ex.pairs.every(([l]) => links[l] !== undefined);

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
      <Prompt text={ex.prompt} />
      <p className="hint">Choisis un élément à gauche, puis son association à droite.</p>
      <div className="match">
        <div className="col">
          {ex.pairs.map(([l]) => {
            let cls = 'option';
            if (leftSel === l) cls += ' selected';
            if (done) cls += links[l] === expected[l] ? ' correct' : ' wrong';
            return (
              <button key={l} className={cls} disabled={done} onClick={() => setLeftSel(l)}>
                <MathText text={l} />
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
              <MathText text={r} />
            </button>
          ))}
        </div>
      </div>
      <Feedback items={done ? res : []} />
      <button className="check" disabled={done || !allLinked} onClick={() => run(links)}>
        Vérifier
      </button>
    </>
  );
}

// ---------- Oral et dialogue ----------

const speechRecognitionClass = () =>
  typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null;

/**
 * Expression orale et prononciation. Si le navigateur ne fournit pas la reconnaissance vocale,
 * l'exercice devient une auto-évaluation face au modèle.
 */
function Speak({ ex, done, onResult }) {
  const Rec = speechRecognitionClass();
  if (!Rec) {
    return (
      <SelfCheck
        ex={{
          ...ex,
          passage: ex.target,
          passageLabel: 'À dire',
          answer: ex.target,
          write: false,
          revealLabel: 'Voir la réponse',
          checklist: [{ label: 'Ta prononciation est proche du modèle', sec: null }],
        }}
        done={done}
        onResult={onResult}
      />
    );
  }
  return <SpeakRecognized ex={ex} done={done} onResult={onResult} Rec={Rec} />;
}

function SpeakRecognized({ ex, done, onResult, Rec }) {
  const [heard, setHeard] = useState('');
  const [listening, setListening] = useState(false);
  const [res, run] = useValidate(ex, onResult);
  const recRef = useRef(null);
  useEffect(() => () => recRef.current?.abort?.(), []);

  const start = () => {
    const r = new Rec();
    r.lang = ex.lang;
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => setHeard(e.results[0][0].transcript);
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    recRef.current = r;
    setListening(true);
    r.start();
  };
  const stop = () => recRef.current?.stop();

  const submit = () => {
    if (done || !heard.trim()) return;
    run(heard);
  };

  return (
    <>
      <Prompt text={ex.prompt} />
      <Block label="À dire">{ex.target}</Block>
      <div className="speak-row">
        <button type="button" className={`mic ${listening ? 'on' : ''}`} disabled={done} onClick={listening ? stop : start}>
          {listening ? '⏹ Arrêter' : '🎤 Parler'}
        </button>
        <AudioButton audio={{ text: ex.target, lang: ex.lang }} label="🔊 Écouter le modèle" />
      </div>
      <input
        className="text-answer"
        value={heard}
        disabled={done}
        placeholder="Ce que tu as dit (tu peux corriger)"
        aria-label="Ce que tu as dit"
        onChange={(e) => setHeard(e.target.value)}
      />
      <Feedback items={done ? res : []} />
      <button className="check" disabled={done || !heard.trim()} onClick={submit}>
        Vérifier
      </button>
    </>
  );
}

/** Dialogue : pour chaque réplique, l'élève choisit la réponse adaptée. Chaque mauvais choix peut avoir son explication. */
function Turns({ ex, done, onResult }) {
  const [picks, setPicks] = useState(() => ex.turns.map(() => undefined));
  const [res, run] = useValidate(ex, onResult);
  const complete = picks.every((p) => p !== undefined);
  const setPick = (i, v) => setPicks((a) => a.map((x, k) => (k === i ? v : x)));
  const submit = () => {
    if (done || !complete) return;
    run(picks);
  };
  return (
    <>
      {ex.turns.map((t, i) => (
        <div key={i} className="turn">
          <p className="say">
            <span>{t.speaker ?? 'Interlocuteur'}</span>
            <MathText text={t.say} />
          </p>
          <div className="options">
            {t.choices.map((c) => {
              let cls = 'option';
              if (!done && picks[i] === c.value) cls += ' selected';
              if (done && c.value === t.correct) cls += ' correct';
              if (done && picks[i] === c.value && c.value !== t.correct) cls += ' wrong';
              return (
                <button key={c.value} className={cls} disabled={done} onClick={() => setPick(i, c.value)}>
                  <MathText text={c.label} />
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <Feedback items={done ? res : []} />
      <button className="check" disabled={done || !complete} onClick={submit}>
        Vérifier
      </button>
    </>
  );
}
