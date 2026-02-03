import express, { Response, Request } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import Logger from './config/logger';
import { authRouter } from './routes/auth.routes';
import { notFoundHandler } from './middlewares/notFoundRoute';
import { errorHandler } from './middlewares/errorHandler';
import { usersRouter } from './routes/users.routes';
import passport from 'passport';
import './config/passport';
import { livestockRouter } from './routes/livestock.routes';
import { vaccinationRouter } from './routes/vaccination.routes';
import { sicknessRouter } from './routes/sickness.routes';
import { treatmentRouter } from './routes/treatment.routes';
import { offtakeRouter } from './routes/offtake.routes';
import { taskRouter } from './routes/task.routes';
import { inventoryRouter } from './routes/inventory.routes';
import { financeRouter } from './routes/finance.routes';
import { diagnosisRouter } from './routes/diagnosis.routes';
import { notificationRouter } from './routes/notification.routes';
import { appointmentRouter } from './routes/appointment.routes';
import { noteRouter } from './routes/note.routes';
import path from 'path';
import { UPLOADS_PATH } from './config/upload';
import { chatRouter } from './routes/chat.routes';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io'; 
import { SocketAuth } from './middlewares/socketAuth';

export const app = express();

export const httpServer = createServer(app);

export const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL === "production" ? false :  ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Authorization', 'Content-Type']
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});


// io.use(SocketAuth.authenticate);
io.use((socket, next) => {
  console.log(`🔑 Socket auth attempt - Headers:`, socket.handshake.headers);
  console.log(`🔑 Socket auth token:`, socket.handshake.auth?.token);
  
  // Call your auth middleware but catch errors
  SocketAuth.authenticate(socket, (error:any) => {
    if (error) {
      console.error(`❌ Socket auth failed:`, error.message);
      console.error(`❌ Full error:`, error);
    } else {
      console.log(`✅ Socket auth successful for user:`, socket.data.user?.id);
    }
    next(error);
  });
});
 
io.on('connection', (socket) => {
  const userId = socket.data.user?.id;
  const userName = socket.data.user?.fullName;
   console.log(`
  ============================================
  🔌 NEW SOCKET CONNECTION
  ============================================
  👤 User ID:    ${userId}
  👤 User Name:  ${userName || 'Unknown'}
  🆔 Socket ID:  ${socket.id}
  🌐 IP Address: ${socket.handshake.address}
  📅 Connected:  ${new Date().toLocaleTimeString()}
  ============================================
  `);
  Logger.info(`Socket connected - User: ${userId}, Socket: ${socket.id}`);
  
  socket.join(`user:${userId}`);
  console.log(`📌 User ${userId} joined room: user:${userId}`);

  socket.on('ping', (callback) => {
	console.log(`🏓 Ping from ${userId} (${socket.id})`);
    if (callback) callback('pong');
  });
  
  socket.on('echo', (data, callback) => {
	console.log(`🔁 Echo from ${userId}: "${data}"`);
    if (callback) callback({ 
      echo: data, 
      timestamp: new Date().toISOString(),
      socketId: socket.id 
    });
  });
  
  
  socket.on('disconnect', () => {
	 console.log(`
    ============================================
    🔌 SOCKET DISCONNECTED
    ============================================
    👤 User ID:    ${userId}
    🆔 Socket ID:  ${socket.id}
    📅 Disconnected: ${new Date().toLocaleTimeString()}
    ============================================
    `);
    Logger.info(`Socket disconnected - User: ${userId}, Socket: ${socket.id}`);
  });
  
  socket.on('error', (error) => {
	console.error(`❌ Socket error for user ${userId}:`, error);
    Logger.error(`Socket error for user ${userId}:`, error);
  });
});



app.use(passport.initialize());


app.use(helmet());
app.use(cors({
	origin: process.env.CORS_ORIGIN || '*', 
	credentials: true, 
	allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

morgan('tiny');
const stream = {
	write: (text: string) => {
		Logger.info(text);
	},
};

app.use(
	morgan(':method :url :status :response-time ms - :res[content-length]', {
		stream,
	})
);

app.get('/', (_req: Request, res: Response) => {
	res.json({ success: true, message: 'Agritech API is working just fine!' });
});

app.get('/socket-status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    socket: {
      connected: io.engine.clientsCount,
      server: 'Socket.IO running',
      port: process.env.PORT || 5000,
	  endpoint: `ws://localhost:${process.env.PORT || 5000}`
    }
  });
});

app.use("/uploads", express.static(UPLOADS_PATH));

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/livestock', livestockRouter);
app.use('/api/v1/', vaccinationRouter);
app.use('/api/v1/sickness', sicknessRouter)
app.use('/api/v1/treatment', treatmentRouter);
app.use('/api/v1/offtake', offtakeRouter);
app.use('/api/v1/tasks', taskRouter)
app.use('/api/v1/inventory', inventoryRouter)
app.use('/api/v1/finance', financeRouter)
app.use('/api/v1/diagnosis', diagnosisRouter)
app.use('/api/v1/notifications', notificationRouter)
app.use('/api/v1/appointments', appointmentRouter)
app.use('/api/v1/notes', noteRouter);
app.use('/api/v1/chat', chatRouter);


app.use(notFoundHandler);
app.use(errorHandler);