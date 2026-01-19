import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod'; // For Zod validation errors
import { Prisma } from '@prisma/client'; // For Prisma errors
import Logger from '../config/logger';
import passport from 'passport';
import { ERROR_CODES } from '../errors/errorTypes';
import { UnauthorizedError } from '../errors/UnauthorizedError';
import { BadRequestError } from '../errors/BadRequestError';
import { ForbiddenError } from '../errors/ForbiddenError';
import { NotFoundError } from '../errors/NotFoundError';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
// export const authenticateJWT = passport.authenticate('jwt', { session: false });

export const authenticateJWT = (
	req: Request,
	res: Response,
	next: NextFunction
): void => {
	passport.authenticate(
		'jwt',
		{ session: false },
		(
			err: { message: any },
			user: Express.User | undefined,
			info: { message: any }
		) => {
			if (err) {
				return res.status(500).json({
					success: false,
					error: 'Internal Server Error',
					details: err.message,
				});
			}
			if (!user) {
				return res.status(401).json({
					success: false,
					error: 'Unauthorized',
					details: info?.message || 'Invalid or missing token',
				});
			}

			req.user = user; // Attach the user to the request object for downstream access
			return next();
		}
	)(req, res, next);
};

// Enhanced Error Handler
export const errorHandler = (
	err: any,
	_req: Request,
	res: Response,
	_next: NextFunction
): void => {
	// Default error response
	let statusCode = 500;
	let errorMessage = 'Internal Server Error';
	let details: any = undefined;

	// Handle Prisma errors
	if (err instanceof Prisma.PrismaClientKnownRequestError) {
		statusCode = 400; // Bad Request
		errorMessage = `Prisma error: ${err.message}`;
		if (err.code === 'P2002') {
			statusCode = ERROR_CODES.CONFLICT;
			errorMessage = 'Unique constraint failed. Duplicate entry.';

			const field = err.meta?.target || 'field';
			details = `A record with this ${ field } already exists`;
		}
	} else if (err instanceof Prisma.PrismaClientValidationError) {
		statusCode = 422; 
		errorMessage = `Database validation error: ${err.message}`;
	}

	// Handle Zod validation errors
	else if (err instanceof ZodError) {
		statusCode = 422;
		errorMessage =  'Validation failed';
		const issues = err.errors.map((issue) => ({
			field: issue.path.join('.').replace(/^body\./, ''),
			message: issue.message.replace(/^\w/, (c) => c.toUpperCase()),
		}));

		const errorMessages = issues.map(
			(err) => `${err.field}: ${err.message}`
		);
		res.status(statusCode).json({
			success: false,
			error: errorMessage,
			message: 'Please correct the following errors:',
			issues,
			errors: errorMessages,
		});
		return;
	}

	// Handle custom application errors
	else if (err instanceof BadRequestError) {
		statusCode = 400; // Bad Request
		errorMessage = err.message || 'Bad Request';
	} else if (err instanceof UnauthorizedError) {
		statusCode = 401; // Unauthorized
		errorMessage = err.message || 'Authentication credentials are invalid.';
	} else if (err instanceof ForbiddenError) {
		statusCode = 403; // Forbidden
		errorMessage =
			err.message || 'You do not have permission to access this resource.';
	} else if (err instanceof NotFoundError) {
		statusCode = 404; // Not Found
		errorMessage = err.message || 'Resource not found.';
	}

	// Handle general errors with a status property
	else if (err.status) {
		statusCode = err.status;
		errorMessage = err.message || 'An error occurred.';
	}
	Logger.error(errorMessage, err);
	// Final response
	res.status(statusCode).json({
		success: false,
		error: errorMessage,
	});
};