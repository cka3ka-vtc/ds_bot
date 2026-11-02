// server/app/events/_event-buffer.js
// Батчинг db.addEvent для высокочастотных событий (messageCreate).
// Раз в FLUSH_INTERVAL_MS сбрасывает буфер в SQLite; при shutdown — принудительно.

const FLUSH_INTERVAL_MS = 500;
const MAX_BUFFER_SIZE = 1000;

let buffer = [];
let flushTimer = null;
let _db = null;
let _logger = null;

export function initEventBuffer({ db, logger }) {
  _db = db;
  _logger = logger;
}

function flush() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  if (!buffer.length || !_db) return;
  const entries = buffer;
  buffer = [];
  for (const entry of entries) {
    try {
      _db.addEvent(entry);
    } catch (err) {
      _logger?.warn({ err, event: 'event_buffer_lost' }, 'event buffer: add failed');
    }
  }
}

export function addBufferedEvent(event) {
  if (!_db) return;
  buffer.push(event);
  if (buffer.length >= MAX_BUFFER_SIZE) {
    flush();
    return;
  }
  if (!flushTimer) {
    flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);
    if (typeof flushTimer.unref === 'function') flushTimer.unref();
  }
}

export function flushEventBuffer() {
  flush();
}