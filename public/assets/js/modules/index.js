import greetings from './greetings.js';

const modules = [greetings];
export const moduleRegistry = new Map(modules.map(m => [m.key, m]));