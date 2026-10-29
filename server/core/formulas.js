// server/core/formulas.js
// Формулы уровней. Звания — в shared/titles.js.

export function xpForLevel(level, formula = 'classic', opts = {}) {
  if (level <= 0) return 0;
  if (formula === 'linear') {
    const base = opts.linearBase ?? 100;
    return base * level;
  }
  return 5 * level * level + 50 * level + 100;
}

export function getLevelFromXp(totalXp, formula = 'classic', opts = {}, maxLevel = 500) {
  const xp = Math.max(0, totalXp | 0);
  let lo = 0, hi = Math.max(1, maxLevel);
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (xpForLevel(mid, formula, opts) <= xp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function progressOf(totalXp, level, formula, opts) {
  const base = xpForLevel(level, formula, opts);
  const next = xpForLevel(level + 1, formula, opts);
  const current = Math.max(0, totalXp - base);
  const total = Math.max(1, next - base);
  return {
    current,
    total,
    percent: Math.min(100, Math.round((current / total) * 100)),
    toNext: Math.max(0, total - current),
  };
}