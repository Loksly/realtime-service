import { Application } from 'express';
import { Server } from 'http';

export interface Plugin {
  /** Unique plugin name */
  name: string;
  /** Semantic version */
  version: string;
  /**
   * Called once at startup. Plugins may register routes, middleware, or
   * attach listeners to the HTTP server / Socket.io instance.
   */
  initialize(
    app: Application,
    server: Server,
    options?: Record<string, unknown>
  ): Promise<void>;
}
