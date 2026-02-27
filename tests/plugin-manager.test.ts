import { PluginManager } from '../src/plugins/plugin-manager';
import { Plugin } from '../src/plugins/plugin.interface';
import { Application } from 'express';
import { Server } from 'http';

// Silence logger during tests
jest.mock('../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  auditLogger: { info: jest.fn() },
}));

function makePlugin(name: string, version = '1.0.0'): Plugin & { initSpy: jest.Mock } {
  const initSpy = jest.fn().mockResolvedValue(undefined);
  return {
    name,
    version,
    initialize: initSpy,
    initSpy,
  };
}

describe('PluginManager', () => {
  let manager: PluginManager;
  const fakeApp = {} as Application;
  const fakeServer = {} as Server;

  beforeEach(() => {
    manager = new PluginManager();
  });

  describe('register', () => {
    it('registers a plugin successfully', () => {
      const plugin = makePlugin('test-plugin');
      manager.register(plugin);
      expect(manager.getPlugin('test-plugin')).toBe(plugin);
    });

    it('throws when registering a duplicate name', () => {
      manager.register(makePlugin('dup'));
      expect(() => manager.register(makePlugin('dup'))).toThrow(
        'Plugin "dup" is already registered'
      );
    });
  });

  describe('getPlugins', () => {
    it('returns empty array when no plugins registered', () => {
      expect(manager.getPlugins()).toEqual([]);
    });

    it('returns all registered plugins', () => {
      const p1 = makePlugin('p1');
      const p2 = makePlugin('p2');
      manager.register(p1);
      manager.register(p2);
      expect(manager.getPlugins()).toHaveLength(2);
    });
  });

  describe('getPlugin', () => {
    it('returns undefined for unknown plugin', () => {
      expect(manager.getPlugin('unknown')).toBeUndefined();
    });
  });

  describe('initializeAll', () => {
    it('calls initialize on each plugin with app and server', async () => {
      const p1 = makePlugin('p1');
      const p2 = makePlugin('p2');
      manager.register(p1);
      manager.register(p2);

      await manager.initializeAll(fakeApp, fakeServer);

      expect(p1.initSpy).toHaveBeenCalledWith(fakeApp, fakeServer, undefined);
      expect(p2.initSpy).toHaveBeenCalledWith(fakeApp, fakeServer, undefined);
    });

    it('passes per-plugin options when provided', async () => {
      const p = makePlugin('opt-plugin');
      manager.register(p);
      const opts = { 'opt-plugin': { foo: 'bar' } };

      await manager.initializeAll(fakeApp, fakeServer, opts);

      expect(p.initSpy).toHaveBeenCalledWith(fakeApp, fakeServer, { foo: 'bar' });
    });

    it('rethrows when a plugin initialize rejects', async () => {
      const badPlugin: Plugin = {
        name: 'bad',
        version: '0.1.0',
        initialize: jest.fn().mockRejectedValue(new Error('init failed')),
      };
      manager.register(badPlugin);

      await expect(manager.initializeAll(fakeApp, fakeServer)).rejects.toThrow('init failed');
    });

    it('initializes plugins in registration order', async () => {
      const order: string[] = [];
      const makeOrdered = (name: string): Plugin => ({
        name,
        version: '1.0.0',
        initialize: jest.fn().mockImplementation(async () => {
          order.push(name);
        }),
      });

      manager.register(makeOrdered('first'));
      manager.register(makeOrdered('second'));
      manager.register(makeOrdered('third'));

      await manager.initializeAll(fakeApp, fakeServer);

      expect(order).toEqual(['first', 'second', 'third']);
    });
  });
});
