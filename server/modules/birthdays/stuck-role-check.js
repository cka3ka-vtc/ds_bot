// server/modules/birthdays/stuck-role-check.js
//
// Safety net для «залипших» ролей именинника:
//   1. Раз в 30 мин (плановое сканирование) снимает роль, если её день не сегодня.
//   2. Мгновенно при guildMemberUpdate — если роль только что навесили, а день не сегодня.
//
// Рутинные сканы пишут debug-лог (не видно в дашборде), а вот мгновенное
// снятие после ручного добавления роли — это warn (видно).

const TICK_MS = 5 * 60_000;
const SCAN_INTERVAL_MS = 30 * 60_000;

const ymd = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const ddmm = (d) => {
  const day = String(d.getDate()).padStart(2, '0');
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${mon}`;
};

export class StuckRoleChecker {
  constructor({ db, logger, botManager, getConfig }) {
    this.db = db;
    this.logger = logger;
    this.botManager = botManager;
    this.getConfig = getConfig;
    this._interval = null;
    this._lastScanAt = new Map();
  }

  start() {
    if (this._interval) return;
    this._interval = setInterval(() => this._tick().catch(() => {}), TICK_MS);
    this._interval.unref?.();
    this._tick({ force: true }).catch(() => {});
  }

  stop() {
    if (this._interval) clearInterval(this._interval);
    this._interval = null;
    this._lastScanAt.clear();
  }

  async _tick({ force = false } = {}) {
    const now = Date.now();
    const todayDdMm = ddmm(new Date());

    for (const inst of this.botManager.all()) {
      if (!inst?.client?.isReady?.()) continue;
      for (const guild of inst.client.guilds.cache.values()) {
        const key = `${inst.id}:${guild.id}`;
        const last = this._lastScanAt.get(key) || 0;
        if (!force && now - last < SCAN_INTERVAL_MS) continue;

        try {
          await this._checkGuild(inst, guild, todayDdMm);
          this._lastScanAt.set(key, now);
        } catch (err) {
          this.logger.warn(
            { err, botId: inst.id, guildId: guild.id },
            'birthdays: stuck role check failed',
          );
        }
      }
    }
  }

  async _checkGuild(inst, guild, todayDdMm) {
    const botId = inst.id;
    const guildId = guild.id;

    const { enabled, config } = await this.getConfig(botId, guildId).catch(() => ({}));
    if (!enabled || !config?.birthdayRoleId) return;

    const role = guild.roles.cache.get(config.birthdayRoleId)
      || await guild.roles.fetch(config.birthdayRoleId).catch(() => null);
    if (!role) return;

    let members = role.members;
    if (!members || members.size === 0) {
      members = await guild.members.fetch({ role: role.id }).catch(() => role.members);
    }
    if (!members || members.size === 0) return;

    let removed = 0;
    for (const member of members.values()) {
      try {
        const bday = this.db.getBirthday(botId, guildId, member.id);
        const keep = bday?.birthday === todayDdMm && !!bday?.birthday_public;
        if (keep) continue;

        await member.roles.remove(role.id, 'Снятие зависшей роли именинника');
        try { this.db.clearBirthdayRoleUntil(botId, guildId, member.id); } catch {}
        removed++;
      } catch (err) {
        this.logger.debug(
          { err, botId, guildId, userId: member.id },
          'birthdays: stuck role remove failed',
        );
      }
    }

    if (removed > 0) {
      this.logger.info(
        { botId, guildId, removed, total: members.size },
        'birthdays: stuck roles cleaned',
      );
      // ФИКС: routine cleanup — debug-уровень, НЕ показывается в «Последних событиях».
      // Раньше был level:'info' — и в дашборде каждая такая запись отображалась
      // как «Празднует сегодня день рождения», что путало пользователей.
      try {
        this.db.addLog(botId, guildId, {
          level: 'debug',
          module: 'birthdays',
          message: `Снято зависших ролей именинника: ${removed}`,
          meta: { removed, total: members.size, todayDdMm },
        });
      } catch {}
    }
  }

  async checkMemberOnRoleChange({ client, oldMember, newMember }) {
    const guild = newMember?.guild;
    if (!guild) return;
    if (!newMember?.user || newMember.user.bot) return;

    const botId = client.user.id;
    const guildId = guild.id;

    const { enabled, config } = await this.getConfig(botId, guildId).catch(() => ({}));
    if (!enabled || !config?.birthdayRoleId) return;

    const roleId = config.birthdayRoleId;

    const hadRole = oldMember?.roles?.cache?.has(roleId) ?? false;
    const hasRole = newMember.roles?.cache?.has(roleId) ?? false;
    if (hadRole || !hasRole) return;

    const todayDdMm = ddmm(new Date());
    const bday = this.db.getBirthday(botId, guildId, newMember.id);
    const keep = bday?.birthday === todayDdMm && !!bday?.birthday_public;
    if (keep) return;

    try {
      await newMember.roles.remove(roleId, 'Роль именинника: день не сегодня');
      try { this.db.clearBirthdayRoleUntil(botId, guildId, newMember.id); } catch {}

      this.logger.info(
        {
          botId, guildId, userId: newMember.id,
          storedBirthday: bday?.birthday || null,
          birthdayPublic: !!bday?.birthday_public,
          todayDdMm,
        },
        'birthdays: role removed on member update (wrong day)',
      );

      // Оставляем warn — это значимое событие, но с корректным текстом.
      // Дашборд покажет: «Зависшая роль именинника — день не сегодня»
      // вместе с именем и аватаром пользователя.
      try {
        this.db.addLog(botId, guildId, {
          level: 'warn',
          module: 'birthdays',
          message: 'Роль именинника снята: день не сегодня',
          userId: newMember.id,
          meta: {
            userId: newMember.id,
            username: newMember.user.username,
            displayName: newMember.displayName || newMember.user.globalName || newMember.user.username,
            avatarUrl: newMember.user.displayAvatarURL?.({ size: 128 }) || null,
            storedBirthday: bday?.birthday || null,
            todayDdMm,
          },
        });
      } catch {}
    } catch (err) {
      this.logger.warn(
        { err, botId, guildId, userId: newMember.id },
        'birthdays: failed to remove wrong-day role',
      );
    }
  }
}