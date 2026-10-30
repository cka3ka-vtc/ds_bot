// server/modules/messages.js
// Обработка кнопок role-buttons из редактора сообщений.
// custom_id: role_<section>_<roleId>_<buttonId>, где buttonId = "b_<random36>".

import { Module } from './_base.js';

// section — [a-z0-9]+ (greetings / levels),
// roleId  — [0-9]+ (Discord ID),
// buttonId — [a-z0-9_]+ (b_xxxxxxxx)
const ROLE_BUTTON_RE = /^role_[a-z0-9]+_(\d+)_([a-z0-9_]+)$/i;

export default class MessagesModule extends Module {
  get key() { return 'messages'; }

  async onEvent({ event, client, guildId, interaction }) {
    if (event !== 'interactionCreate') return;
    if (!interaction.isButton?.()) return;

    const customId = interaction.customId || '';
    const match = customId.match(ROLE_BUTTON_RE);
    if (!match) return;

    const roleId = match[1];
    const guild = interaction.guild;
    if (!guild) {
      return interaction.reply({
        content: '⚠ Кнопка доступна только на сервере',
        ephemeral: true,
      }).catch(() => {});
    }

    const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
    if (!role) {
      return interaction.reply({
        content: '❌ Роль не найдена — возможно, она была удалена',
        ephemeral: true,
      }).catch(() => {});
    }

    const me = guild.members.me;
    if (!me?.permissions?.has('ManageRoles')) {
      return interaction.reply({
        content: '❌ У бота нет права «Управление ролями»',
        ephemeral: true,
      }).catch(() => {});
    }

    if (role.position >= me.roles.highest.position) {
      return interaction.reply({
        content: '❌ Роль выше роли бота — выдать нельзя',
        ephemeral: true,
      }).catch(() => {});
    }

    const member = interaction.member;
    const hasRole = member.roles.cache.has(roleId);

    try {
      if (hasRole) {
        await member.roles.remove(roleId, 'Role-button из панели');
      } else {
        await member.roles.add(roleId, 'Role-button из панели');
      }
      await interaction.reply({
        content: hasRole
          ? `✅ Роль **${role.name}** снята`
          : `✅ Роль **${role.name}** выдана`,
        ephemeral: true,
      }).catch(() => {});
    } catch (err) {
      this.logger.warn(
        { err, guildId, userId: interaction.user.id, roleId },
        'messages: role-button toggle failed',
      );
      await interaction.reply({
        content: '❌ Не удалось изменить роль',
        ephemeral: true,
      }).catch(() => {});
    }
  }
}