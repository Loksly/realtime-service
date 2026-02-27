import { Application } from 'express';
import { Server } from 'http';
import { Plugin } from './plugin.interface';
import { logger } from '../utils/logger';

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();

  /** Register a plugin. Throws if a plugin with the same name already exists. */
  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already registered`);
    }
    this.plugins.set(plugin.name, plugin);
    logger.info(`Plugin registered: ${plugin.name}@${plugin.version}`);
  }

  /**
   * Initialize all registered plugins in registration order.
   * Per-plugin options can be supplied via the `options` map keyed by plugin name.
   */
  async initializeAll(
    app: Application,
    server: Server,
    options?: Record<string, Record<string, unknown>>
  ): Promise<void> {
    for (const [name, plugin] of this.plugins) {
      try {
        await plugin.initialize(app, server, options?.[name]);
        logger.info(`Plugin initialized: ${name}`);
      } catch (error) {
        logger.error(`Failed to initialize plugin "${name}":`, error);
        throw error;
      }
    }
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }
}
