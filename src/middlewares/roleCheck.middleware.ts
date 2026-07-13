import { Request, Response, NextFunction } from 'express';

export const requireRoles = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction):void => {
    const user = (req as any).user;
    // console.log('🔐 [requireRoles] req.user:', user);
    if (!user || !allowedRoles.includes(user.role)) {
       res.status(403).json({ 
        success: false,
        error: `Forbidden: Requires one of these roles: ${allowedRoles.join(', ')}` 
      });
      return;
    }
    next();
  };
};