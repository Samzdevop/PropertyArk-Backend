import express, { Response, Request } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import Logger from './config/logger';
import { authRouter } from './routes/auth.routes';
import { notFoundHandler } from './middlewares/notFoundRoute.middleware';
import { errorHandler } from './middlewares/errorHandler.middleware';
import { usersRouter } from './routes/users.routes';
import passport from 'passport';
import './config/passport';
// import path from 'path';
import { UPLOADS_PATH } from './config/upload';
import { propertyRouter } from './routes/property.routes';
import { ninRouter } from './routes/nin.routes';
import { activityRouter } from './routes/activity.routes';
import { emailRouter } from './routes/email.routes';

export const app = express();


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
	res.json({ success: true, message: 'PropertyArk API is working just fine!' });
});

app.use("/uploads", express.static(UPLOADS_PATH));

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/properties', propertyRouter);
app.use('/api/v1/nin', ninRouter);
app.use('/api/v1/activity', activityRouter);
app.use('/api/v1/email', emailRouter);




app.use(notFoundHandler);
app.use(errorHandler);