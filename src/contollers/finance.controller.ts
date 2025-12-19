import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { sendSuccessResponse } from '../utils/sendSuccessResponse';
import { NotFoundError } from '../errors/NotFoundError';
import { getFileUrl } from '../config/upload';
import { ForbiddenError } from '../errors/ForbiddenError';


export const recordFinancialTransaction = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];
    const userId = (req.user as any).id;
    const mediaUrls = files?.map(file => getFileUrl(file.filename)) || [];
    const { companyId } = req.params;

    const {
      type,
      referenceNumber,
      title,
      amount,
      paymentMethod,
      date,
      description,
      partyName
    } = req.body;

    const transaction = await prisma.financialTransaction.create({
      data: {
        type,
        referenceNumber,
        title,
        amount: parseFloat(amount),
        paymentMethod,
        date: new Date(date),
        description: description || null,
        partyName,
        mediaUrls,
        recordedById: userId,
        companyId,
      },
      include: {
        recordedBy: {
          select: {
            id: true,
            fullName: true
          }
        }
      }
    });

    sendSuccessResponse(
      res,
      'Financial transaction recorded successfully',
      { transaction },
      201
    );
  } catch (error) {
    next(error);
  }
};

export const getFinancialTransactions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      type, 
      startDate, 
      endDate,
      paymentMethod
    } = req.query;

    // const where: any = {};

    // if (type) where.type = String(type);
    // if (paymentMethod) where.paymentMethod = String(paymentMethod);
    // if (startDate || endDate) {
    //   where.date = {};
    //   if (startDate) where.date.gte = new Date(String(startDate));
    //   if (endDate) where.date.lte = new Date(String(endDate));
    // }

        const currentUser = req.user as any;

    if (!currentUser.companyId) {
      throw new ForbiddenError('User is not associated with a company');
    }

    const where: any = {
      companyId: currentUser.companyId,
    };

    if (type) {
      where.type = String(type);
    }

    if (paymentMethod) {
      where.paymentMethod = String(paymentMethod);
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(String(startDate));
      if (endDate) where.date.lte = new Date(String(endDate));
    }
  
    const [transactions, total] = await Promise.all([
      prisma.financialTransaction.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { date: 'desc' },
        include: {
          recordedBy: {
            select: {
              id: true,
              fullName: true
            }
          }
        }
      }),
      prisma.financialTransaction.count({ where })
    ]);

    sendSuccessResponse(res, 'Financial transactions retrieved successfully', {
      transactions,
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

export const getFinancialTransaction = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { transactionId } = req.params;

    const transaction = await prisma.financialTransaction.findUnique({
      where: { id: transactionId },
      include: {
        recordedBy: {
          select: {
            id: true,
            fullName: true,
            role: true
          }
        }
      }
    });

    if (!transaction) {
      throw new NotFoundError('Financial transaction not found');
    }

    sendSuccessResponse(res, 'Financial transaction retrieved successfully', {
      transaction
    });
  } catch (error) {
    next(error);
  }
};