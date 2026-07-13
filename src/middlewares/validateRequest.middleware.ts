import { ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const validateRequest =
	(schema: ZodSchema) => (req: Request, _res: Response, next: NextFunction) => {
		try {
			schema.parse({
				body: req.body,
				query: req.query,
				params: req.params,
			});
			next(); // Proceed to the next middleware or route handler
		} catch (err) {
			next(err);
		}
	};