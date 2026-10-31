// shared/ui-strings.js
// Агрегатор строк UI. Все данные вынесены в ./strings/* по доменам.
// Публичный API не меняется: `import { UI } from '/shared/ui-strings.js'`
// продолжает работать — UI собирается из модулей ниже.

import { pluralize } from './strings/_pluralize.js';

import { brand, common, words, actions, toast, errors } from './strings/common.js';
import { nav, pages, moduleLabels } from './strings/nav.js';
import { sidebar } from './strings/sidebar.js';
import { topbar } from './strings/topbar.js';
import { overview, userModals } from './strings/overview.js';
import { commands } from './strings/commands.js';
import { moderation } from './strings/moderation.js';
import { modulesGrid } from './strings/modules.js';
import { bots } from './strings/bots.js';
import { servers } from './strings/servers.js';
import { msgEditor } from './strings/msg-editor.js';
import { greetings } from './strings/greetings.js';
import { levels } from './strings/levels.js';
import { members } from './strings/members.js';
import { landingTour, settingsStub } from './strings/misc.js';

export { pluralize };

export const UI = {
  brand,
  common,
  words,
  actions,
  toast,
  errors,
  nav,
  pages,
  moduleLabels,
  sidebar,
  topbar,
  overview,
  userModals,
  commands,
  moderation,
  modulesGrid,
  bots,
  servers,
  msgEditor,
  greetings,
  levels,
  members,
  landingTour,
  settingsStub,
};

export default UI;