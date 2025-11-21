"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFinancialTransaction = exports.getFinancialTransactions = exports.recordFinancialTransaction = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const NotFoundError_1 = require("../errors/NotFoundError");
const upload_1 = require("../config/upload");
const recordFinancialTransaction = async (req, res, next) => {
    try {
        const files = req.files;
        const userId = req.user.id;
        const mediaUrls = files?.map(file => (0, upload_1.getFileUrl)(file.filename)) || [];
        const { type, referenceNumber, title, amount, paymentMethod, date, description, partyName } = req.body;
        const transaction = await prisma_1.default.financialTransaction.create({
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
                recordedById: userId
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
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Financial transaction recorded successfully', { transaction }, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.recordFinancialTransaction = recordFinancialTransaction;
const getFinancialTransactions = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, type, startDate, endDate, paymentMethod } = req.query;
        const where = {};
        if (type)
            where.type = String(type);
        if (paymentMethod)
            where.paymentMethod = String(paymentMethod);
        if (startDate || endDate) {
            where.date = {};
            if (startDate)
                where.date.gte = new Date(String(startDate));
            if (endDate)
                where.date.lte = new Date(String(endDate));
        }
        const [transactions, total] = await Promise.all([
            prisma_1.default.financialTransaction.findMany({
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
            prisma_1.default.financialTransaction.count({ where })
        ]);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Financial transactions retrieved successfully', {
            transactions,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getFinancialTransactions = getFinancialTransactions;
const getFinancialTransaction = async (req, res, next) => {
    try {
        const { transactionId } = req.params;
        const transaction = await prisma_1.default.financialTransaction.findUnique({
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
            throw new NotFoundError_1.NotFoundError('Financial transaction not found');
        }
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Financial transaction retrieved successfully', {
            transaction
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getFinancialTransaction = getFinancialTransaction;
