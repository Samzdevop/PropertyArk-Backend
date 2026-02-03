import { Server } from 'socket.io';
import { redisClient, redisSubscriber } from '../config/redis';
import { SocketAuth } from '../middlewares/socketAuth';
import { SocketHandlers } from '../socket/socket.handlers';
import { SocketEvents } from '../socket/socket.events';
import { createAdapter } from '@socket.io/redis-adapter';

export class SocketServer {
  private io: Server;
  private handlers: SocketHandlers;
  private events: SocketEvents;
  private connectedUsers: Map<string, string> = new Map();

  constructor(server: any) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
        credentials: true
      },
      // adapter: createRedisAdapter(),
      transports: ['websocket', 'polling']
    });

    this.io.adapter(createAdapter(redisClient, redisSubscriber) as any);

    this.handlers = new SocketHandlers(this.io, this.connectedUsers);
    this.events = new SocketEvents(this.io, this.handlers, this.connectedUsers);
    
    this.setupMiddleware();
    this.setupConnection();

    this.getIO = () => this.io;
  }

  private setupMiddleware(): void {
    // Socket authentication
    this.io.use(SocketAuth.authenticate);
  }

  private setupConnection(): void {
    this.io.on('connection', (socket) => {
      const userId = socket.data.user.id;

      this.connectedUsers.set(userId, socket.id);
      
      console.log(`Socket connected: ${userId} (${socket.id})`);
      
      this.events.setupSocketEvents(socket);
    
      socket.on('disconnect', () => {
        this.connectedUsers.delete(userId);
        console.log(`Socket disconnected: ${userId}`);
        
        this.handlers.updateUserPresence(userId, false);
        
        this.handlers.notifyContactsOfStatusChange(userId, 'offline');
      });
    });
  }

  public getIO(): Server {
    return this.io;
  }

  public getConnectedUsers(): Map<string, string> {
    return new Map(this.connectedUsers);
  }

  public isUserConnected(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }

  public getSocketId(userId: string): string | undefined {
    return this.connectedUsers.get(userId);
  }
}

export default SocketServer;

