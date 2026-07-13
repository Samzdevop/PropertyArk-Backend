import { Request, Response, NextFunction } from 'express';

export const notFoundHandler = (
	req: Request,
	res: Response,
	_next: NextFunction
) => {
	res.status(404).json({
		success: false,
		error: 'Route not found',
		details: `The requested URL ${req.originalUrl} was not found on this server.`,
	});
};