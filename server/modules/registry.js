// server/modules/registry.js
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { configCache } from '../core/config-cache.js';

export class ModuleRegistry {
  constructor({ db, logger, eventBus, botManager }) {
    this.ctx = { db, logger, eventBus, botManager };
    this.logger = logger;
    this.db = db;
    this.modules = new Map();
    this.manifest = null;
    this.missingModules = [];
  }

  async load() {
    const manifestPath = path.resolve('shared/modules.manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Manifest not found: ${manifestPath}`);
    }

    this.manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const modulesDir = path.resolve('server/modules');

    for (const entry of this.manifest.modules) {
      const filePath = path.join(modulesDir, `${entry.key}.js`);

      if (!fs.existsSync(filePath)) {
        this.missingModules.push(entry.key);
        this.logger.warn(
          { module: entry.key, expectedPath: filePath },
          'module file not found — skipping',
        );
        continue;
      }

      try {
        const mod = await import(pathToFileURL(filePath).href + `?v=${Date.now()}`);
        const ModClass = mod.default || mod.Module;
        if (typeof ModClass !== 'function') {
          throw new Error(`Module ${entry.key} does not export a class`);
        }

        const instance = new ModClass(this.ctx);
        if (instance.key !== entry.key) {
          throw new Error(`Module key mismatch: ${instance.key} !== ${entry.key}`);
        }

        instance.meta = entry;
        this.modules.set(entry.key, instance);
        await instance.register();

        this.logger.info({ module: entry.key }, 'module loaded');
      } catch (err) {
        this.missingModules.push(entry.key);
        this.logger.error({ err, module: entry.key }, 'failed to load module — skipping');
      }
    }

    this.logger.info(
      {
        loaded: this.modules.size,
        total: this.manifest.modules.length,
        missing: this.missingModules,
      },
      'modules loaded',
    );
  }

  async unregisterAll() {
    for (const [key, mod] of this.modules) {
      try { await mod.unregister?.(); }
      catch (err) { this.logger.warn({ err, module: key }, 'module unregister failed'); }
    }
  }

  get(key) { return this.modules.get(key); }
  all() { return [...this.modules.values()]; }

  /** Использует кэш enabled-модулей. */
  async dispatch(event) {
    const { botId, guildId } = event;
    if (!guildId) return;

    const enabled = await configCache.getEnabled(this.db, botId, guildId);
    for (const key of enabled) {
      const mod = this.modules.get(key);
      if (!mod) continue;
      if (mod.meta.events && !mod.meta.events.includes(event.event)) continue;

      try {
        await mod.onEvent(event);
      } catch (err) {
        this.logger.error(
          { err, module: key, botId, guildId },
          'module handler error',
        );
      }
    }
  }
}