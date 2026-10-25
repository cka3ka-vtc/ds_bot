/* ============================================================
   Реестр всех slash-команд.

   Единственная точка, откуда register-commands.js
   и interactions/commands.js берут список команд.

   Если добавляете новую команду — импортируйте её сюда.
   ============================================================ */

import hb from './hb.js';
import profile from './profile.js';
import company from './company.js';
import { makeFieldCommand } from './profile-fields.js';

/* Команды, которые не сводятся к фабрике (свои subcommand'ы, логика) */
const baseCommands = [hb, profile, company];

/* vtc/steam/hmp/tmp — одинаковые по структуре, различаются только
   полем профиля. Генерируются фабрикой, чтобы не дублировать код. */
const fieldCommands = [
  makeFieldCommand({
    name: 'vtc',
    field: 'vtc',
    label: 'VTC',
    description: 'Установить VTC в профиле'
  }),
  makeFieldCommand({
    name: 'steam',
    field: 'steam',
    label: 'Steam',
    description: 'Установить Steam в профиле'
  }),
  makeFieldCommand({
    name: 'hmp',
    field: 'haulmp',
    label: 'HaulMP',
    description: 'Установить HaulMP в профиле'
  }),
  makeFieldCommand({
    name: 'tmp',
    field: 'truckersmp',
    label: 'TruckersMP',
    description: 'Установить TruckersMP в профиле'
  })
];

const commands = [...baseCommands, ...fieldCommands];

export default commands;