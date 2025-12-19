import { Router } from 'express';
import {
  createInventoryRecord,
  getInventoryItem,
  getInventoryItems,
  getInventoryRecord,
  getInventoryRecords,
} from '../contollers/inventory.controller';
import { authenticateJWT } from '../middlewares/errorHandler';
import { validateRequest } from '../middlewares/validateRequest';
import {
  createInventoryRecordSchema,
} from '../schemas/inventory.schemas';

import { requireRoles } from '../middlewares/roleCheck';
import { upload } from '../config/upload';

export const inventoryRouter = Router();

// Create inventory records (NEW, ITEM, USE)
inventoryRouter.post(
  '/records/:companyId',
  authenticateJWT,
  requireRoles(['ADMIN', 'FARM_KEEPER']),
  upload.array('media'),
  // (req, res, next) => {
  //   console.log('=== INCOMING REQUEST DATA ===');
  //   console.log('Headers:', req.headers);
  //   console.log('Body:', req.body);
  //   console.log('Files:', (req.files as Express.Multer.File[] | undefined)?.map(f => ({
  //     originalname: f.originalname,
  //     mimetype: f.mimetype,
  //     size: f.size
  //   })));
  //   console.log('============================');
  //   next();
  // },
  validateRequest(createInventoryRecordSchema),
  createInventoryRecord
);


// Get all inventory records (NEW/ITEM/USE)
inventoryRouter.get(
  '/records',
  authenticateJWT,
  getInventoryRecords
);

// Get specific inventory record
inventoryRouter.get(
  '/records/:recordId',
  authenticateJWT,
  getInventoryRecord
);

// Get all inventory items
inventoryRouter.get(
  '/items',
  authenticateJWT,
  getInventoryItems
);

// Get specific inventory item with its records
inventoryRouter.get(
  '/items/:inventoryId',
  authenticateJWT,
  getInventoryItem
);