import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';
import { keyMatchesPattern } from '../utils/key-pattern';
import { AuthenticatedUser } from '../types';

export class SocketService {
  private io: SocketIOServer;
  private subscriber: Redis;

  constructor(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
    });

    this.subscriber = new Redis(config.redisUrl, {
      db: config.redisDb,
      lazyConnect: true,
    });

    this.setupAuthentication();
    this.setupSubscriptions();
  }

  private setupAuthentication(): void {
    this.io.use((socket, next) => {
      const token =
        (socket.handshake.auth as Record<string, string>)?.token ??
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication required'));
      }

      try {
        const decoded = jwt.verify(token, config.jwtSecret) as AuthenticatedUser;
        socket.data.user = decoded;
        next();
      } catch {
        next(new Error('Invalid token'));
      }
    });

    this.io.on('connection', (socket) => {
      logger.info(
        `Socket client connected: ${socket.id}, user: ${
          (socket.data.user as AuthenticatedUser | undefined)?.username ?? 'unknown'
        }`
      );

      socket.on('disconnect', () => {
        logger.info(`Socket client disconnected: ${socket.id}`);
      });

      /** Subscribe to key-change events for a given pattern */
      socket.on('subscribe', (pattern: string) => {
        socket.join(`pattern:${pattern}`);
        logger.info(`Client ${socket.id} subscribed to pattern: ${pattern}`);
      });

      socket.on('unsubscribe', (pattern: string) => {
        socket.leave(`pattern:${pattern}`);
        logger.info(`Client ${socket.id} unsubscribed from pattern: ${pattern}`);
      });
    });
  }

  private setupSubscriptions(): void {
    // Redis keyspace notifications must be enabled on the server:
    //   notify-keyspace-events "KEA"
    this.subscriber.psubscribe(`__keyevent@${config.redisDb}__:*`, (err) => {
      if (err) {
        logger.error('Failed to subscribe to Redis keyspace notifications:', err);
        return;
      }
      logger.info(`Subscribed to Redis keyspace notifications on db ${config.redisDb}`);
    });

    this.subscriber.on('pmessage', (_pattern, channel, message) => {
      // channel: __keyevent@0__:set  |  message: <key name>
      const eventType = channel.split(':').pop();
      const key = message;

      if (!keyMatchesPattern(key, config.redisKeyPattern)) {
        return;
      }

      const event = { key, event: eventType, timestamp: new Date().toISOString() };
      this.io.emit('keyChange', event);
      logger.debug(`Emitted keyChange event: ${JSON.stringify(event)}`);
    });

    this.subscriber.on('error', (err) => {
      logger.error('Redis subscriber error:', err);
    });
  }

  async close(): Promise<void> {
    await this.subscriber.quit();
    await new Promise<void>((resolve) => this.io.close(() => resolve()));
  }

  getIO(): SocketIOServer {
    return this.io;
  }
}
