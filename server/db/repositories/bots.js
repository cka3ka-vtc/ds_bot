// server/db/repositories/bots.js
export function createBotsRepo(db) {
  return {
    createBot(b) {
      db.prepare(`
        INSERT INTO bots (id, owner_id, name, avatar_url, token_encrypted, is_main)
        VALUES (@id, @owner_id, @name, @avatar_url, @token_encrypted, @is_main)
      `).run({ is_main: 0, ...b, owner_id: b.owner_id || null });
    },
    getBot(id) { return db.prepare('SELECT * FROM bots WHERE id = ?').get(id); },
    getMainBot() { return db.prepare('SELECT * FROM bots WHERE is_main = 1').get(); },
    getAllBots() { return db.prepare('SELECT * FROM bots WHERE enabled = 1').all(); },
    getBotsForUser(userId) {
      return db.prepare(`
        SELECT * FROM bots
        WHERE is_main = 1 OR owner_id = ?
        ORDER BY is_main DESC, created_at ASC
      `).all(userId);
    },
    deleteBot(id) {
      db.prepare('DELETE FROM bots WHERE id = ? AND is_main = 0').run(id);
    },
  };
}