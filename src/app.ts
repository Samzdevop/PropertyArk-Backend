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

export const app = express();

app.use(passport.initialize());

// Configuration
app.use(helmet());
app.use(cors({
	origin: process.env.CORS_ORIGIN || '*', // Allow all origins by default
	credentials: true, // Allow credentials if needed
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


app.use(notFoundHandler);
app.use(errorHandler);