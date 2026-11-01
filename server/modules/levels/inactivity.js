// server/modules/levels/inactivity.js
import { getLevelFromXp } from '../../core/formulas.js';
import { mergeLevelsConfig } from '../../../shared/levels-config.js';

/**
 * Фоновые задачи модуля «Уровни»:
 *   - _inactivityTick — раз в час снимает XP с неактивных участников;
 *   - _cleanup        — раз в 10 минут чистит _cooldowns / _useCooldowns /
 *                       _memberCache. НЕ трогает configCache — за него
 *                       отвечает bootstrap.js (единый интервал).
 *   - _parseAutoRoles — распаковка auto_roles (JSON-массив).
 */
export function mountInactivityMethods(LevelsModule) {
  Object.assign(LevelsModule.prototype, {

    async _inactivityTick() {
      const now = Math.floor(Date.now() / 1000);
      const dayAgo = now - 86_400;

      for (const inst of this.botManager.all()) {
        if (!inst?.client?.isReady()) continue;
        for (const guild of inst.client.guilds.cache.values()) {
          try {
            const { enabled, config: rawConfig } = await this.getConfig(inst.id, guild.id);
            if (!enabled) continue;
            const config = mergeLevelsConfig(rawConfig);
            if (!config.inactivity.enabled) continue;

            const threshold = now - config.inactivity.days * 86400;
            const inactive = this.db.getInactive(inst.id, guild.id, threshold);

            for (const row of inactive) {
              const lastPenalty = row.last_penalty_at | 0;
              if (lastPenalty > dayAgo) continue;

              const oldXp = row.xp | 0;
              const newXp = Math.max(0, oldXp - config.inactivity.penaltyXp);
              if (newXp === oldXp) continue;

              const newLevel = getLevelFromXp(newXp, config.formula, config, config.maxLevel);
              const oldLevel = row.level | 0;
              const currentAuto = this._parseAutoRoles(row.auto_roles);
              let newAuto = currentAuto;

              if (newLevel < oldLevel && config.inactivity.removeRolesOnDecrease && config.rewards.enabled) {
                const allowed = new Set(
                  config.rewards.entries.filter((r) => Number(r.level) <= newLevel).map((r) => r.roleId),
                );
                const toRemove = currentAuto.filter((id) => !allowed.has(id));
                const member = guild.members.cache.get(row.user_id);
                if (member) {
                  const removed = [];
                  for (const roleId of toRemove) {
                    try {
                      await member.roles.remove(roleId);
                      removed.push(roleId);
                    } catch (err) {
                      this.logger.warn({ err, roleId, userId: row.user_id }, 'levels: inactivity role remove failed');
                    }
                  }
                  newAuto = currentAuto.filter((id) => allowed.has(id) || !removed.includes(id));
                }
              }

              this.db.applyPenalty(inst.id, guild.id, row.user_id, {
                xp: newXp, level: newLevel, autoRoles: newAuto,
              });

              this._invalidateMemberCache(inst.id, guild.id, row.user_id);

              this.db.addLog(inst.id, guild.id, {
                level: 'warn', module: 'levels',
                message: `XP −${config.inactivity.penaltyXp} (${config.inactivity.days} дн. неактивности)`,
                meta: { userId: row.user_id, fromXp: oldXp, toXp: newXp },
              });
            }
          } catch (err) {
            this.logger.warn({ err, guildId: guild.id }, 'levels: inactivity tick failed');
          }
        }
      }
    },

    /**
     * Чистит только внутренние Map'ы модуля. Глобальный configCache
     * чистится в bootstrap.js (единый интервал на весь сервис).
     */
    _cleanup() {
      const now = Date.now();

      for (const [k, ts] of this._cooldowns) {
        if (now - ts > 24 * 3600_000) this._cooldowns.delete(k);
      }
      for (const [k, ts] of this._useCooldowns) {
        if (now - ts > 24 * 3600_000) this._useCooldowns.delete(k);
      }
      for (const [k, entry] of this._memberCache) {
        if (now - entry.ts > this._MEMBER_CACHE_TTL * 4) this._memberCache.delete(k);
      }
    },

    _parseAutoRoles(raw) {
      try { return Array.isArray(raw) ? raw : JSON.parse(raw || '[]'); } catch { return []; }
    },

  });
}