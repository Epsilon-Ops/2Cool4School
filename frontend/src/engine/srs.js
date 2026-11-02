const DAY = 86400000;

/**
 * Répétition espacée inspirée de SM-2.
 * quality : 1 (raté), 3 (moyen), 4 (bien), 5 (facile)
 */
export function nextCard(card, quality, now = Date.now()) {
  let { ease = 2.5, interval = 0, reps = 0 } = card ?? {};

  if (quality < 3) {
    // Question ratée : elle revient bientôt (environ 12 h)
    reps = 0;
    interval = 0.5;
  } else {
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 3;
    else interval = Math.round(interval * ease);
    ease = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  }

  return {
    ease,
    interval,
    reps,
    dueAt: now + interval * DAY,
    lastQuality: quality,
    seen: (card?.seen ?? 0) + 1,
  };
}
