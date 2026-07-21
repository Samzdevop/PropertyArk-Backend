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
import { favoriteRouter } from './routes/favorite.routes';
import { inquiryRouter } from './routes/inquiry.routes';
import { vendorRouter } from './routes/vendor.routes';
import { viewStatsRouter } from './routes/viewStats.routes';

export const app = express();


app.use(passport.initialize());


app.use(helmet());

const allowedOrigins = [
	'http://localhost:3000',
	'http://localhost:5173',
]
app.use(cors({
	origin: function (origin, callback ) {
		if (!origin) return callback(null, true);
		if (allowedOrigins.indexOf(origin) === -1) {
			const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
			return callback(new Error(msg), false);
		}
		return callback(null, true);
	},
	credentials: true, 
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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
app.use('/api/v1/favorites',  favoriteRouter);
app.use('/api/v1/inquiries',  inquiryRouter);
app.use('/api/v1/vendor',  vendorRouter);
app.use('/api/v1/view-stats', viewStatsRouter);




app.use(notFoundHandler);
app.use(errorHandler);