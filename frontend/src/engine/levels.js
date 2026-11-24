/**
 * Niveau global : progression logarithmique.
 *
 * XP totaux nécessaires pour atteindre le niveau L :
 *   T(L) = BASE × (GROWTH^(L−1) − 1) / (GROWTH − 1)
 * Chaque niveau demande GROWTH fois plus d'XP que le précédent : les premiers niveaux vont vite,
 * les suivants demandent de plus en plus d'efforts. Inverse : niveau(xp) = 1 + ⌊log(1 + xp·(GROWTH−1)/BASE) / log(GROWTH)⌋.
 */
export const LEVEL_BASE = 100;   // XP pour passer du niveau 1 au niveau 2
export const LEVEL_GROWTH = 1.3; // chaque niveau coûte 30 % de plus que le précédent

/** XP totaux nécessaires pour atteindre `level` (0 pour le niveau 1). */
export function xpForLevel(level) {
  if (level <= 1) return 0;
  return Math.round((LEVEL_BASE * (LEVEL_GROWTH ** (level - 1) - 1)) / (LEVEL_GROWTH - 1));
}

/** Niveau atteint avec `xp` points d'expérience. */
export function levelFromXp(xp) {
  const x = Math.max(0, xp);
  return 1 + Math.floor(Math.log(1 + (x * (LEVEL_GROWTH - 1)) / LEVEL_BASE) / Math.log(LEVEL_GROWTH));
}

/**
 * Détail du niveau : niveau actuel, pourcentage parcouru dans ce niveau,
 * XP déjà gagnés dans ce niveau, et XP restants avant le niveau suivant.
 */
export function levelInfo(xp) {
  const total = Math.max(0, Math.floor(xp));
  const level = levelFromXp(total);
  const start = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const span = next - start;
  const into = total - start;
  return {
    xp: total,
    level,
    start,
    next,
    into,
    toNext: next - total,
    pct: Math.min(100, Math.round((100 * into) / span)),
  };
}
