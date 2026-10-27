// server/bots/instance.js
import { Client, GatewayIntentBits, Events } from 'discord.js';

export class BotInstance {
  constructor({ id, token, isMain, name, avatarUrl, logger, eventBus }) {
    this.id = id;
    this.token = token;
    this.isMain = isMain;
    this.name = name;
    this.avatarUrl = avatarUrl;
    this.logger = logger;
    this.eventBus = eventBus;
    this.client = null;
    this.rateLimitHits = 0;
    this.startedAt = null;
  }

  async start() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,   // ⚡ обязательно для voiceStateUpdate
      ],
    });
    this._wireEvents();
    await this.client.login(this.token);

    this.id = this.client.user.id;
    this.name = this.client.user.username;
    this.avatarUrl = this.client.user.displayAvatarURL({ size: 128 });
    this.startedAt = Date.now();

    // Счётчик rate-limit hits (для health)
    try {
      this.client.rest.on('rateLimited', () => {
        this.rateLimitHits++;
      });
    } catch {}

    this.logger.info(
      { botId: this.id, tag: this.client.user.tag, isMain: this.isMain },
      'bot started',
    );
  }

  async stop() {
    if (this.client) {
      this.logger.info({ botId: this.id }, 'bot stopping');
      await this.client.destroy();
      this.client = null;
    }
  }

  _wireEvents() {
    const emit = (name) => (data) => {
      const guildId = data.guild?.id || data.guildId || null;
      this.eventBus.emit(name, {
        botId: this.id, guildId, client: this.client, ...data,
      });
    };

    this.client.on(Events.GuildCreate,  emit('guildCreate'));
    this.client.on(Events.GuildDelete,  emit('guildDelete'));
    this.client.on(Events.GuildMemberAdd,    emit('guildMemberAdd'));
    this.client.on(Events.GuildMemberRemove, emit('guildMemberRemove'));

    this.client.on(Events.MessageCreate, (message) => {
      if (message.author.bot) return;
      this.eventBus.emit('messageCreate', {
        botId: this.id,
        guildId: message.guild?.id,
        client: this.client,
        message,
      });
    });

    this.client.on(Events.InteractionCreate, (interaction) => {
      this.eventBus.emit('interactionCreate', {
        botId: this.id,
        guildId: interaction.guildId,
        client: this.client,
        interaction,
      });
    });

    // ⚡ НОВОЕ: голосовые события
    this.client.on(Events.VoiceStateUpdate, (oldState, newState) => {
      const guildId = newState.guild?.id || oldState.guild?.id || null;
      this.eventBus.emit('voiceStateUpdate', {
        botId: this.id,
        guildId,
        client: this.client,
        oldState,
        newState,
      });
    });

    this.client.on(Events.Error, (err) => {
      this.logger.error({ err, botId: this.id }, 'client error');
    });
  }
}