// server/modules/birthdays/index.js
import { Module } from '../_base.js';

// Монтаж методов на прототип.
import { mountSchedulerMethods } from './scheduler.js';
import { mountCommandMethods } from './commands.js';

// Safety net: снятие «зависших» ролей именинника
// (раз в сутки + мгновенно на guildMemberUpdate).
import { StuckRoleChecker } from './stuck-role-check.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Модуль «Дни рождения»
 * ═══════════════════════════════════════════════════════════════════════════
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

mountSchedulerMethods(BirthdaysModule);
mountCommandMethods(BirthdaysModule);