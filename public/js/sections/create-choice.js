/* ============================================================
   Модалка выбора способа создания: с нуля / импорт JSON.

   Импорт проходит через серверную валидацию — если файл битый,
   покажется список ошибок в toast.
   ============================================================ */

import { modal, toast } from '../ui.js';
import { api } from '../api.js';
import { state } from '../state.js';

/**
 * Открывает модалку «Создать / Импортировать».
 * @param {object} opts
 * @param {string} opts.title
 * @param {Function} [opts.onCreate]
 * @param {Function} [opts.onImport] - получает уже валидированные данные
 * @param {string} [opts.validateSection] - имя секции для /api/validate
 */
export function openCreateChoice({ title, onCreate, onImport, validateSection = null }) {
  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
  footer.innerHTML = `<button type="button" class="btn btn-ghost" data-cancel>Отмена</button>`;

  const body = `
    <p style="color:var(--text-dim);margin-bottom:16px;">Выберите способ создания</p>
    <div class="choice-grid">
      <button type="button" class="choice-card" data-choice="create">
        <div class="choice-card-icon"><i class="fa-solid fa-plus"></i></div>
        <strong>Создать с нуля</strong>
        <span>Откроется редактор с пустым шаблоном</span>
      </button>
      <button type="button" class="choice-card" data-choice="import">
        <div class="choice-card-icon"><i class="fa-solid fa-upload"></i></div>
        <strong>Импортировать</strong>
        <span>Загрузить JSON-файл с настройками</span>
      </button>
    </div>
  `;

  const m = modal({ title, body, footer });

  m.bodyEl.querySelector('[data-choice="create"]').addEventListener('click', () => {
    m.close();
    onCreate?.();
  });

  m.bodyEl.querySelector('[data-choice="import"]').addEventListener('click', () => {
    m.close();
    runImportWithValidation(validateSection).then(data => {
      if (data) onImport?.(data);
    });
  });

  footer.querySelector('[data-cancel]').addEventListener('click', () => m.close());
}

/* ============================================================
   Импорт с валидацией
   ============================================================ */

async function runImportWithValidation(section) {
  const file = await pickFile();
  if (!file) return null;

  /* Парсим JSON */
  let data;
  try {
    const text = await file.text();
    data = JSON.parse(text);
  } catch (e) {
    toast('Невалидный JSON: ' + e.message, { type: 'error', duration: 6000 });
    return null;
  }

  /* Если секция известна — прогоняем через Zod на сервере */
  if (!section) return data;

  try {
    const result = await api.validateData(state.guildId, section, data);
    if (!result.ok) {
      const lines = result.errors.slice(0, 4)
        .map(e => `• ${e.path || 'root'}: ${e.message}`)
        .join('\n');
      toast(`Файл не прошёл валидацию:\n${lines}`, { type: 'error', duration: 8000 });
      return null;
    }
  } catch (e) {
    toast('Ошибка валидации: ' + e.message, { type: 'error' });
    return null;
  }

  return data;
}

function pickFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => resolve(input.files[0] || null);
    input.click();
  });
}