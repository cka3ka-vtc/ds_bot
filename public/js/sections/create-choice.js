import { modal } from '../ui.js';

export function openCreateChoice({ title, onCreate, onImport }) {
  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
  footer.innerHTML = `<button type="button" class="btn btn-ghost" data-cancel>Отмена</button>`;

  const body = `
    <p style="color:var(--text-dim);margin-bottom:16px;">Выберите способ создания</p>
    <div class="choice-grid">
      <button type="button" class="choice-card" data-choice="create">
        <div class="choice-card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </div>
        <strong>Создать с нуля</strong>
        <span>Открыть редактор с пустым шаблоном</span>
      </button>
      <button type="button" class="choice-card" data-choice="import">
        <div class="choice-card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        </div>
        <strong>Импортировать</strong>
        <span>Загрузить JSON-файл с настройками</span>
      </button>
    </div>
  `;

  const m = modal({ title, body, footer });
  m.bodyEl.querySelector('[data-choice="create"]').addEventListener('click', () => { m.close(); onCreate?.(); });
  m.bodyEl.querySelector('[data-choice="import"]').addEventListener('click', () => { m.close(); onImport?.(); });
  footer.querySelector('[data-cancel]').addEventListener('click', () => m.close());
}