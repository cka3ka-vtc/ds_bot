// server/modules/birthdays/index.js
import { Module } from '../_base.js';

// Монтаж методов на прототип.
import { mountSchedulerMethods } from './scheduler.js';
import { mountCommandMethods } from './commands.js';

// Safety net: снятие «зависших» ролей именинника
// (раз в сутки + мгновенно на guildMemberUpdate).
import { StuckRoleChecker } from './stuck-role-checker.js';

/**
 * ═══════════════════════════════════════════════════════════════════════
 *  Модуль «Дни рождения»
 *
 *  Класс-ядро: конструктор + register/unregister + onEvent.
 *  Вся остальная логика разнесена по файлам:
 *
 *   scheduler.js          — _tick, _expireRoles, _cleanupOldAnnouncements,
 *                           _announceBirthdays (раз в минуту: снятие истёкших
 *                           ролей по birthday_role_until, удаление старых
 *                           поздравлений, отправка новых в sendTime)
 *
 *   commands.js           — handleCommand, _cmdSet/_cmdToggle/_cmdList,
 *                           _replyWithConfig
 *
 *   stuck-role-checker.js — раз в 10 минут проверяет смену дня + мгновенно
 *                           реагирует на появление роли именинника в
 *                           guildMemberUpdate, если ДР ≠ сегодня — снимает.
 *
 *  Публичный контракт (registry.get('birthdays').handleCommand(...)) не меняется.
 * ═══════════════════════════════════════════════════════════════════════
 */
export default class BirthdaysModule extends Module {
  get key() { return 'birthdays'; }

  constructor(ctx) {
    super(ctx);
    this._tickInterval = null;
    this._startTimer = null;
    this._useCooldowns = new Map();
    this._stuckRoleChecker = null;
  }

  async register() {
    // первый тик через 10 сек (после «прогрева»), далее раз в минуту
    this._startTimer = setTimeout(() => this._tick().catch(() => {}), 10_000);
    this._tickInterval = setInterval(() => this._tick().catch(() => {}), 60_000);

    this._stuckRoleChecker = new StuckRoleChecker({
      db: this.db,
      logger: this.logger,
      botManager: this.botManager,
      getConfig: (botId, guildId) => this.getConfig(botId, guildId),
    });
    this._stuckRoleChecker.start();

    this.logger.info({ module: 'birthdays' }, 'birthdays: registered');
  }

  async unregister() {
    clearTimeout(this._startTimer);
    clearInterval(this._tickInterval);
    this._useCooldowns.clear();

    if (this._stuckRoleChecker) {
      this._stuckRoleChecker.stop();
      this._stuckRoleChecker = null;
    }
  }

  /**
   * События от registry.dispatch.
   * Нас интересует только guildMemberUpdate — для мгновенного снятия
   * ошибочно выданной роли именинника.
   */
  async onEvent({ event, client, guildId, oldMember, newMember }) {
    if (event !== 'guildMemberUpdate') return;
    if (!guildId || !newMember) return;
    if (this._stuckRoleChecker) {
      await this._stuckRoleChecker.checkMemberOnRoleChange({
        client, oldMember, newMember,
      });
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Монтаж методов на прототип.
   ═══════════════════════════════════════════════════════════════════════ */

mountSchedulerMethods(BirthdaysModule);
mountCommandMethods(BirthdaysModule);