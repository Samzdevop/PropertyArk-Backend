import { Router } from 'express';
import {
  recordFinancialTransaction,
  getFinancialTransactions,
  getFinancialTransaction
} from '../contollers/finance.controller';
import { authenticateJWT } from '../middlewares/errorHandler';
import { validateRequest } from '../middlewares/validateRequest';
import { financialTransactionSchema } from '../schemas/finance.schemas';
import { requireRoles } from '../middlewares/roleCheck';
import { upload } from '../config/upload';

export const financeRouter = Router();

financeRouter.post(
  '/transactions/:companyId',
  authenticateJWT,
  requireRoles(['ADMIN', 'FARM_KEEPER']),
  upload.array('media'),
  validateRequest(financialTransactionSchema),
  recordFinancialTransaction
);

financeRouter.get(
  '/transactions',
  authenticateJWT,
  getFinancialTransactions
);

financeRouter.get(
  '/transactions/:transactionId',
  authenticateJWT,
  getFinancialTransaction
);