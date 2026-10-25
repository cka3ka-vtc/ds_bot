/* ============================================================
   Zod-схемы для валидации всех данных, приходящих через API.

   Единая точка правды о структуре данных:
   - изменения в UI → сначала обновите схему здесь
   - сервер не примет невалидный объект
   ============================================================ */

import { z } from 'zod';

/* ---------- Общие примитивы ---------- */

const Snowflake = z.string().regex(/^\d{17,20}$/, 'Некорректный Discord ID');
const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Некорректный цвет');
const UrlOrEmpty = z.string().url().optional().or(z.literal(''));

/* ---------- Блоки Discord-сообщений ---------- */

const Block = z.discriminatedUnion('type', [
  z.object({
    id: z.string(),
    type: z.literal('text'),
    content: z.string().max(4000)
  }),
  z.object({
    id: z.string(),
    type: z.literal('sections'),
    title: z.string(),
    listStyle: z.enum(['numeric', 'dot']),
    items: z.array(z.string())
  }),
  z.object({
    id: z.string(),
    type: z.literal('separator'),
    divider: z.boolean(),
    spacing: z.number().int().min(1).max(2)
  }),
  z.object({
    id: z.string(),
    type: z.literal('image'),
    url: z.string().optional()
  }),
  z.object({
    id: z.string(),
    type: z.literal('images'),
    urls: z.array(z.string())
  }),
  z.object({
    id: z.string(),
    type: z.literal('file'),
    url: z.string().optional()
  }),
  z.object({
    id: z.string(),
    type: z.literal('thumbnail'),
    url: UrlOrEmpty
  }),
  z.object({
    id: z.string(),
    type: z.literal('buttons'),
    buttons: z.array(z.object({
      id: z.string(),
      label: z.string().max(80),
      url: z.string(),
      emoji: z.string().optional(),
      disabled: z.boolean().optional()
    })).max(5)
  }),
  z.object({
    id: z.string(),
    type: z.literal('role-buttons'),
    buttons: z.array(z.object({
      id: z.string(),
      label: z.string().max(80),
      style: z.enum(['primary', 'secondary', 'success', 'danger']),
      roleId: z.string(),
      emoji: z.string().optional(),
      ephemeral: z.any().optional()
    })).max(5)
  }),
  z.object({
    id: z.string(),
    type: z.literal('select-menu'),
    customId: z.string().optional(),
    placeholder: z.string().max(150).optional(),
    minValues: z.number().int().min(1).max(25).optional(),
    maxValues: z.number().int().min(1).max(25).optional(),
    options: z.array(z.object({
      label: z.string().max(100),
      value: z.string().max(100),
      description: z.string().max(100).optional(),
      emoji: z.string().optional()
    })).max(25)
  }),
  z.object({
    id: z.string(),
    type: z.literal('footer'),
    content: z.string().max(4000)
  })
]);

/* ---------- Конфиг сообщения (используется во всех разделах) ---------- */

const MessageConfig = z.object({
  displayMode: z.enum(['flat', 'embed', 'embed-color']),
  accentColor: HexColor.optional(),
  title: z.string().max(4000).optional(),
  subtitle: z.string().max(4000).optional(),
  thumbnail: z.string().optional(),
  blocks: z.array(Block).max(40)
});

/* ---------- Общие подструктуры ---------- */

const MentionSchema = z.object({
  type: z.enum(['none', 'everyone', 'role', 'user']),
  roleId: z.string().optional(),
  userId: z.string().optional()
});

const AutoDeleteSchema = z.object({
  enabled: z.boolean(),
  minutes: z.number()
});

const ProfileSchema = z.object({
  vtc: z.string().max(500).optional().or(z.literal('')),
  steam: z.string().max(500).optional().or(z.literal('')),
  haulmp: z.string().max(500).optional().or(z.literal('')),
  truckersmp: z.string().max(500).optional().or(z.literal('')),
  companySince: z.string().nullable().optional()
}).optional();

/* ============================================================
   Схемы разделов
   ============================================================ */

export const RulesSchema = MessageConfig.extend({
  channelId: z.string().optional()
});

export const MessagesSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    name: z.string().max(100),
    channelId: z.string(),
    channelName: z.string().optional(),
    config: MessageConfig,
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    lastSentAt: z.string().nullable().optional(),
    lastMessageId: z.string().nullable().optional(),
    messageDeleted: z.boolean().optional()
  }))
});

export const AnnouncementsSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    name: z.string().max(100),
    channelId: z.string(),
    channelName: z.string().optional(),
    icon: z.string().max(64).optional(),
    enabled: z.boolean(),
    config: MessageConfig,
    schedule: z.object({
      type: z.enum(['manual', 'interval', 'daily', 'weekly', 'monthly']),
      intervalMinutes: z.number().optional(),
      time: z.string().optional(),
      dayOfWeek: z.number().optional(),
      dayOfMonth: z.number().optional()
    }),
    autoDelete: AutoDeleteSchema,
    eventTime: z.object({
      enabled: z.boolean(),
      type: z.enum(['daily', 'weekly', 'monthly']),
      time: z.string().optional(),
      dayOfWeek: z.number().optional(),
      dayOfMonth: z.number().optional()
    }),
    mention: MentionSchema,
    nextRunAt: z.number().nullable().optional(),
    lastSentAt: z.string().nullable().optional(),
    lastMessageId: z.string().nullable().optional(),
    messageDeleted: z.boolean().optional(),
    _autoDeleteAt: z.number().nullable().optional()
  }))
});

export const DelayedSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    name: z.string().max(100),
    channelId: z.string(),
    channelName: z.string().optional(),
    config: MessageConfig,
    publishAt: z.string().nullable().optional(),
    mention: MentionSchema,
    autoDelete: AutoDeleteSchema.optional(),
    lastSentAt: z.string().nullable().optional(),
    lastMessageId: z.string().nullable().optional(),
    messageDeleted: z.boolean().optional(),
    _autoDeleteAt: z.number().nullable().optional(),
    _failed: z.boolean().optional()
  }))
});

export const AutodeleteSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    name: z.string().max(100),
    channelId: z.string(),
    channelName: z.string().optional(),
    mode: z.enum(['instant', 'delayed']),
    deleteAfterMinutes: z.number().int().min(1).max(10080).optional(),
    enabled: z.boolean(),
    createdAt: z.string().optional()
  }))
});

export const BirthdaysSchema = z.object({
  settings: z.object({
    time: z.string().regex(/^\d{2}:\d{2}$/, 'Формат HH:MM'),
    roleId: z.string().optional(),
    channelId: z.string().optional(),
    enabled: z.boolean(),
    lastRunDate: z.string().nullable().optional(),
    roleRemoveNextDay: z.boolean().optional(),
    autoDeleteMessage: z.boolean().optional(),
    requiredRoleIds: z.array(z.string()).optional(),
    _pending: z.array(z.any()).optional()
  }),
  users: z.array(z.object({
    userId: z.string(),
    day: z.number().int().min(1).max(31).nullable().optional(),
    month: z.number().int().min(1).max(12).nullable().optional(),
    year: z.number().int().min(1900).max(2100).nullable().optional(),
    enabled: z.boolean().optional(),
    profile: ProfileSchema
  })),
  template: MessageConfig,
  templateNoYear: MessageConfig.optional()
});

export const ProfilesSchema = z.object({
  settings: z.object({
    channelId: z.string().optional().or(z.literal('')),
    requiredRoleIds: z.array(z.string()).optional(),
    template: MessageConfig.nullable().optional()
  })
});

export const SettingsSchema = z.object({
  botEnabled: z.boolean(),
  modules: z.object({
    announcements: z.boolean(),
    autodelete: z.boolean(),
    birthdays: z.boolean(),
    profiles: z.boolean()
  }),
  prefix: z.string().max(10),
  language: z.enum(['ru', 'en']),
  logChannel: z.string()
});

export const AutodeleteQueueSchema = z.object({
  items: z.array(z.object({
    channelId: z.string(),
    messageId: z.string(),
    deleteAt: z.number()
  }))
});

/* ============================================================
   Схемы для отдельных эндпоинтов
   ============================================================ */

export const SendBodySchema = z.object({
  clearChannel: z.boolean().optional()
});

export const SendMessageSchema = z.object({
  messageId: z.string(),
  clearChannel: z.boolean().optional()
});

export const SendAnnouncementSchema = z.object({
  announcementId: z.string(),
  clearChannel: z.boolean().optional()
});

export const SendDelayedSchema = z.object({
  itemId: z.string(),
  clearChannel: z.boolean().optional()
});

export const GuildIdSchema = Snowflake;

export const SectionSchema = z.enum([
  'rules', 'messages', 'announcements', 'delayed', 'autodelete',
  'birthdays', 'profiles', 'autodelete-queue', 'settings', 'logs'
]);

export const TokenSchema = z.object({
  token: z.string().min(20, 'Токен слишком короткий')
});

/* ============================================================
   Конфиг активного бота (activity / status)
   ============================================================ */

export const ActivitySchema = z.object({
  type: z.enum(['PLAYING', 'WATCHING', 'LISTENING', 'COMPETING', 'STREAMING']),
  text: z.string().min(1).max(128),
  url: z.string().url().nullable().optional()
});

export const BotUpsertSchema = z.object({
  label: z.string().min(1).max(50),
  token: z.string().min(20),
  activity: ActivitySchema.optional()
});