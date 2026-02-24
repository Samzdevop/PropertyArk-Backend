"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSicknessById = exports.getAllSickness = exports.reportSickness = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const NotFoundError_1 = require("../errors/NotFoundError");
const selects_1 = require("../prisma/selects");
const BadRequestError_1 = require("../errors/BadRequestError");
const reportSickness = async (req, res, next) => {
    try {
        const { dateOfObservation, observedSymptoms, suspectedCause, notes, healthStatus } = req.body;
        const livestockId = req.params.livestockId;
        const recordedById = req.user.id;
        if (healthStatus && !['SICK', 'CRITICAL'].includes(healthStatus)) {
            throw new BadRequestError_1.BadRequestError('Health status must be either SICK or CRITICAL when reporting sickness');
        }
        // Verify livestock exists
        const livestock = await prisma_1.default.livestock.findUnique({
            where: { id: livestockId }
        });
        if (!livestock)
            throw new NotFoundError_1.NotFoundError('Livestock not found');
        // Create sickness record and update livestock status in a transaction
        const [sickness] = await prisma_1.default.$transaction([
            prisma_1.default.sickness.create({
                data: {
                    livestockId,
                    dateOfObservation: new Date(dateOfObservation),
                    observedSymptoms,
                    suspectedCause,
                    notes,
                    recordedById,
                },
                include: {
                    livestock: true,
                    recordedBy: { select: selects_1.userSelect },
                },
            }),
            prisma_1.default.livestock.update({
                where: { id: livestockId },
                data: {
                    isSick: true,
                    healthStatus: healthStatus || 'SICK'
                },
            }),
        ]);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Sickness successfully reported', { sickness }, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.reportSickness = reportSickness;
// Get all sickness records
const getAllSickness = async (req, res, next) => {
    try {
        const currentUser = req.user;
        const { page = 1, limit = 10, livestockId } = req.query;
        const where = {
            ...(livestockId && { livestockId: String(livestockId) }),
            livestock: {
                companyId: currentUser.companyId,
                isDeleted: false
            }
        };
        const sicknessRecords = await prisma_1.default.sickness.findMany({
            where,
            skip: (Number(page) - 1) * Number(limit),
            take: Number(limit),
            include: {
                livestock: true,
                recordedBy: { select: selects_1.userSelect },
                treatments: true
            },
            orderBy: { dateOfObservation: 'desc' }
        });
        const total = await prisma_1.default.sickness.count({ where });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Sickness records retrieved', {
            sicknessRecords,
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
exports.getAllSickness = getAllSickness;
// Get single sickness record
const getSicknessById = async (req, res, next) => {
    try {
        const sickness = await prisma_1.default.sickness.findUnique({
            where: { id: req.params.sicknessId },
            include: {
                livestock: true,
                recordedBy: { select: selects_1.userSelect },
                treatments: true
            }
        });
        if (!sickness)
            throw new NotFoundError_1.NotFoundError('Sickness record not found');
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Sickness record retrieved', { sickness });
    }
    catch (error) {
        next(error);
    }
};
exports.getSicknessById = getSicknessById;
