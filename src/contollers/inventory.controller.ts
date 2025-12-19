import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { sendSuccessResponse } from '../utils/sendSuccessResponse';
import { NotFoundError } from '../errors/NotFoundError';
import { getFileUrl } from '../config/upload';
import { BadRequestError } from '../errors/BadRequestError';


export const createInventoryRecord = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];
    const userId = (req.user as any).id;
    const { companyId } = req.params;
    const mediaUrls = files?.map(file => getFileUrl(file.filename)) || [];
    const { recordType } = req.body;

    switch (recordType) {
      case 'NEW': {
        const { type, name, quantity, purchasePricePerUnit, supplierName, reorderPoint, date, notes } = req.body;

        const parsedQuantity = parseFloat(quantity);
        const parsedPrice = parseFloat(purchasePricePerUnit);
        const parsedReorderPoint = parseFloat(reorderPoint);

        if (isNaN(parsedQuantity) || isNaN(parsedPrice) || isNaN(parsedReorderPoint)) {
          throw new BadRequestError('Invalid number format in input');
        }
        
        const inventory = await prisma.inventory.create({
          data: {
            type,
            name,
            company: {
              connect: { id: companyId }
            },
            currentQuantity: parsedQuantity,
            purchasePrice: parsedPrice,
            reorderPoint: parsedReorderPoint,
            supplier: supplierName,
            notes,
            mediaUrls,
            records: {
              create: {
                recordType,
                quantity: parsedQuantity,
                pricePerUnit: parsedPrice,
                totalCost: parsedQuantity * parsedPrice,
                date: new Date(date),
                notes,
                mediaUrls,
                recordedById: userId,
                companyId,
              }
            },
          },
          include: { records: true }
        });

       sendSuccessResponse(res, 'New inventory created', { inventory }, 201);
       break;
      }

    case 'ITEM': {
        const {
          itemToRestock,
          quantityReceived,
          purchasePricePerUnit,
          supplierName,
          date,
          notes,
        } = req.body;

        const parsedQuantityRecieved = parseFloat(quantityReceived);
        const parsedPrice = parseFloat(purchasePricePerUnit);

        if (isNaN(parsedQuantityRecieved) || isNaN(parsedPrice)) {
          throw new BadRequestError('Invalid number format in ITEM restock input');
        }

        const inventory = await prisma.inventory.update({
          where: { id: itemToRestock },
          data: {
            currentQuantity: { increment: parsedQuantityRecieved },
            supplier: supplierName,
            records: {
              create: {
                recordType,
                quantity: parsedQuantityRecieved,
                pricePerUnit: parsedPrice,
                totalCost: parsedQuantityRecieved * parsedPrice,
                date: new Date(date),
                notes,
                mediaUrls,
                recordedById: userId,
                companyId,
              },
            },
          },
          include: { records: true },
        });

        sendSuccessResponse(res, 'Inventory restocked', { inventory });
        break;
      }


      case 'USE': {
        const { itemToUse, quantityToUse, movementType, date, relatedAnimals, notes } = req.body;

        const parsedQuantityToUse = parseFloat(quantityToUse);

        if (isNaN(parsedQuantityToUse)) {
          throw new BadRequestError('Invalid quantityToUse');
        }

        const inventory = await prisma.inventory.update({
          where: { id: itemToUse },
          data: {
            currentQuantity: { decrement: parsedQuantityToUse },
            records: {
              create: {
                recordType,
                quantity: parsedQuantityToUse,
                movementType,
                date: new Date(date),
                relatedAnimals,
                notes,
                mediaUrls,
                recordedById: userId,
                companyId,
              }
            }
          },
          include: { records: true }
        });

        sendSuccessResponse(res, 'Inventory usage recorded', { inventory });
        break;
      }

    }
  } catch (error) {
    next(error);
  }
};

export const getInventoryRecords = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      recordType,
      inventoryId,
      startDate,
      endDate 
    } = req.query;

    // const where: any = {};
    const currentUser = req.user as any;

    if (!currentUser?.companyId) {
      res.status(403).json({
        success: false,
        message: 'User is not associated with a company',
      });
      return;
    }

    const where: any = {
      companyId: currentUser.companyId,
    };

    if (recordType) where.recordType = String(recordType);
    if (inventoryId) where.inventoryId = String(inventoryId);
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(String(startDate));
      if (endDate) where.date.lte = new Date(String(endDate));
    }

    const [records, total] = await Promise.all([
      prisma.inventoryRecord.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { date: 'desc' },
        include: {
          inventory: {
            select: {
              id: true,
              name: true,
              type: true,
              reorderPoint: true,
              supplier: true,
              notes: true,
            }
          },
          recordedBy: {
            select: {
              id: true,
              fullName: true
            }
          }
        }
      }),
      prisma.inventoryRecord.count({ where })
    ]);

    sendSuccessResponse(res, 'Inventory records retrieved', {
      records,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getInventoryRecord = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { recordId } = req.params;

    const record = await prisma.inventoryRecord.findUnique({
      where: { id: recordId },
      include: {
        inventory: true,
        recordedBy: {
          select: {
            id: true,
            fullName: true,
            role: true
          }
        }
      }
    });

    if (!record) {
      throw new NotFoundError('Inventory record not found');
    }

    sendSuccessResponse(res, 'Inventory record retrieved', { record });
  } catch (error) {
    next(error);
  }
};

export const getInventoryItems = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      type,
      lowStock,
      search 
    } = req.query;

    // const where: any = {};
    const currentUser = req.user as any;

    if (!currentUser?.companyId) {
      res.status(403).json({
        success: false,
        message: 'User is not associated with a company',
      });
      return;
    }

    const where: any = {
      companyId: currentUser.companyId,
    };

    if (type) where.type = String(type);
    if (search) where.name = { contains: String(search), mode: 'insensitive' };
    if (lowStock === 'true') {
      where.currentQuantity = {
        lte: prisma.inventory.fields.reorderPoint
      };
    }

    const [items, total] = await Promise.all([
      prisma.inventory.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { name: 'asc' },
        include: {
          records: {
            take: 1,
            orderBy: { date: 'desc' }
          }
        }
      }),
      prisma.inventory.count({ where })
    ]);

    sendSuccessResponse(res, 'Inventory items retrieved', {
      items,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getInventoryItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { inventoryId } = req.params;

    const item = await prisma.inventory.findUnique({
      where: { id: inventoryId },
      include: {
        records: {
          orderBy: { date: 'desc' },
          take: 5
        }
      }
    });

    if (!item) {
      throw new NotFoundError('Inventory item not found');
    }

    sendSuccessResponse(res, 'Inventory item retrieved', { item });
  } catch (error) {
    next(error);
  }
};