/** Courbe d'évolution de la maîtrise : points = [{ t, m }] (m entre 0 et 100). */
export default function Sparkline({ points, width = 260, height = 56 }) {
  if (!points || points.length < 2) {
    return <p className="muted small">Pas encore assez de réponses pour tracer l’évolution.</p>;
  }
  const step = width / (points.length - 1);
  const y = (m) => height - 3 - (Math.max(0, Math.min(100, m)) / 100) * (height - 6);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)} ${y(p.m).toFixed(1)}`).join(' ');
  const last = points[points.length - 1].m;
  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`Évolution de la maîtrise, ${last} % aujourd’hui`}>
      <line x1="0" x2={width} y1={height - 3} y2={height - 3} className="spark-base" />
      <path d={d} className="spark-line" />
    </svg>
  );
}
