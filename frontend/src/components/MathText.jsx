import katex from '../vendor/katex/katex.mjs';
import '../vendor/katex/katex.min.css';

/**
 * Rendu du texte avec formules LaTeX : $…$ (en ligne) et $$…$$ (en bloc).
 * Le texte hors formule est échappé ; une formule invalide reste affichée en rouge, sans faire planter l'appli.
 */
const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const MATH = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;

export function renderMathHtml(text) {
  const src = String(text ?? '');
  let html = '';
  let last = 0;
  let m;
  MATH.lastIndex = 0;
  while ((m = MATH.exec(src))) {
    html += escapeHtml(src.slice(last, m.index));
    const display = m[1] !== undefined;
    html += katex.renderToString(display ? m[1] : m[2], {
      displayMode: display,
      throwOnError: false,
      output: 'htmlAndMathml',
      trust: false,
    });
    last = MATH.lastIndex;
  }
  return html + escapeHtml(src.slice(last));
}

/** Affiche un texte avec ses formules. `as` choisit la balise (span par défaut). */
export default function Math({ text, as: Tag = 'span', className }) {
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: renderMathHtml(text) }} />;
}
