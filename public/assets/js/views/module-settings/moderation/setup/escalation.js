// public/assets/js/views/module-settings/moderation/setup/escalation.js

import {
  defaultEscalationRow, ESCALATION_MAX_LEVELS, escalationRowNeedsDuration,
} from '/shared/moderation-config.js';
import { escalationRowHTML } from '../ui.js';
import { bindSteppers, readStepper, setStepperDisabled } from '../helpers.js';

export function bindEscalation(ctx, card, escCfg) {
  const section = card.querySelector('[data-escalation-section]');
  if (!section) return;

  const { S: Strings } = ctx;
  const toggle = section.querySelector('[data-escalation-toggle]');
  const table = section.querySelector('[data-escalation-table]');
  const footer = section.querySelector('[data-escalation-footer]');
  const addBtn = section.querySelector('[data-escalation-add]');
  const resetToggle = section.querySelector('[data-reset-toggle]');
  const resetHint = section.querySelector('[data-reset-hint]');
  const resetDaysWrap = section.querySelector('[data-reset-days-wrap]');
  const resetDaysEl = section.querySelector('[data-reset-days]');

  function syncVisibility() {
    if (table) table.hidden = !escCfg.enabled;
    if (footer) footer.hidden = !escCfg.enabled;

    if (resetHint) {
      resetHint.textContent = escCfg.resetEnabled
        ? Strings.resetToggleHintOn(escCfg.resetDays)
        : Strings.resetToggleHintOff;
    }
    if (resetDaysWrap) {
      resetDaysWrap.hidden = !escCfg.resetEnabled;
    }
  }

  toggle?.addEventListener('click', () => {
    toggle.classList.toggle('on');
    escCfg.enabled = toggle.classList.contains('on');
    toggle.setAttribute('aria-checked', String(escCfg.enabled));
    syncVisibility();
    // Сообщаем bindActionSection, чтобы тот скрыл/показал fallback-действие
    card.dispatchEvent(new CustomEvent('moderation:escalation-changed', { bubbles: true }));
  });

  resetToggle?.addEventListener('click', () => {
    resetToggle.classList.toggle('on');
    escCfg.resetEnabled = resetToggle.classList.contains('on');
    resetToggle.setAttribute('aria-checked', String(escCfg.resetEnabled));
    syncVisibility();
  });

  resetDaysEl?.querySelector('.num-stepper-input')?.addEventListener('change', () => {
    escCfg.resetDays = Math.max(1, Math.min(90, readStepper(resetDaysEl) || 7));
    syncVisibility();
  });

  function bindRow(row, idx) {
    const actionSel = row.querySelector('[data-esc-action]');
    const durWrap = row.querySelector('[data-esc-duration]');
    const stepper = durWrap?.querySelector('.num-stepper');

    actionSel?.addEventListener('change', (e) => {
      escCfg.rows[idx].action = e.target.value;
      const noDuration = !escalationRowNeedsDuration(e.target.value);
      setStepperDisabled(stepper, noDuration);
      if (noDuration) {
        escCfg.rows[idx].durationMin = 0;
        const input = stepper?.querySelector('.num-stepper-input');
        if (input) input.value = '0';
      }
    });

    durWrap?.querySelector('.num-stepper-input')?.addEventListener('change', () => {
      escCfg.rows[idx].durationMin = readStepper(durWrap);
    });

    row.querySelector('[data-esc-remove]')?.addEventListener('click', () => {
      if (escCfg.rows.length <= 1) return;
      escCfg.rows.splice(idx, 1);
      rerender();
    });

    bindSteppers(row);
    setStepperDisabled(stepper, !escalationRowNeedsDuration(escCfg.rows[idx].action));
  }

  function rerender() {
    table.innerHTML = escCfg.rows.map((r, i) => escalationRowHTML(r, i)).join('');
    table.querySelectorAll('[data-escalation-row]').forEach((row, i) => bindRow(row, i));
    if (addBtn) addBtn.disabled = escCfg.rows.length >= ESCALATION_MAX_LEVELS;
  }

  table?.querySelectorAll('[data-escalation-row]').forEach((row, i) => bindRow(row, i));

  addBtn?.addEventListener('click', () => {
    if (escCfg.rows.length >= ESCALATION_MAX_LEVELS) return;
    escCfg.rows.push(defaultEscalationRow(escCfg.rows.length + 1));
    rerender();
  });

  if (escCfg.rows.length >= ESCALATION_MAX_LEVELS && addBtn) addBtn.disabled = true;

  bindSteppers(section);
  syncVisibility();
}