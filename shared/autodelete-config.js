// shared/autodelete-config.js

export const AUTODELETE_MODES = [
  { value: 'instant', label: 'Удалять все новые' },
  { value: 'after',   label: 'Удалять через время' },
];

export const AUTODELETE_UNITS = [
  { value: 'minutes', label: 'минут', seconds: 60 },
  { value: 'hours',   label: 'часов', seconds: 3600 },
  { value: 'days',    label: 'дней',  seconds: 86400 },
];

const MODE_VALUES = new Set(AUTODELETE_MODES.map((m) => m.value));
const UNIT_VALUES = new Set(AUTODELETE_UNITS.map((u) => u.value));

export function unitSeconds(unit) {
  return AUTODELETE_UNITS.find((u) => u.value === unit)?.seconds || 60;
}

export function unitLabel(unit) {
  return AUTODELETE_UNITS.find((u) => u.value === unit)?.label || unit;
}

export function modeLabel(mode) {
  return AUTODELETE_MODES.find((m) => m.value === mode)?.label || mode;
}

export function delayToSeconds(value, unit) {
  return Math.max(1, Number(value) || 1) * unitSeconds(unit);
}

export function mergeAutodeleteRule(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const mode = MODE_VALUES.has(r.mode) ? r.mode : 'instant';
  const delayUnit = UNIT_VALUES.has(r.delayUnit) ? r.delayUnit : 'minutes';
  const delayValue = Math.max(1, Math.min(365 * 24 * 60, parseInt(r.delayValue, 10) || 30));
  return { mode, delayValue, delayUnit };
}