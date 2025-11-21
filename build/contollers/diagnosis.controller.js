"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteDiagnosis = exports.getDiagnosis = exports.getLivestockDiagnoses = exports.updateDiagnosis = exports.createDiagnosis = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const NotFoundError_1 = require("../errors/NotFoundError");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const createDiagnosis = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const livestockId = req.params.livestockId;
        // Only VET can create diagnosis
        if (userRole !== 'VET') {
            throw new ForbiddenError_1.ForbiddenError('Only veterinarians can create diagnoses');
        }
        const { diagnosis, labTests, severity, prognosis, observations, date } = req.body;
        // Verify livestock exists
        const livestock = await prisma_1.default.livestock.findUnique({
            where: {
                id: livestockId,
                isDeleted: false
            }
        });
        if (!livestock) {
            throw new NotFoundError_1.NotFoundError('Livestock not found');
        }
        const newDiagnosis = await prisma_1.default.diagnosis.create({
            data: {
                livestockId,
                diagnosis,
                labTests,
                severity,
                prognosis,
                observations,
                date: new Date(date),
                recordedById: userId
            },
            include: {
                recordedBy: {
                    select: {
                        id: true,
                        fullName: true,
                        role: true
                    }
                },
                livestock: {
                    select: {
                        id: true,
                        tagId: true,
                        type: true,
                        breed: true
                    }
                }
            }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Diagnosis created successfully', { diagnosis: newDiagnosis }, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.createDiagnosis = createDiagnosis;
const updateDiagnosis = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const diagnosisId = req.params.diagnosisId;
        // Only VET can update diagnosis
        if (userRole !== 'VET') {
            throw new ForbiddenError_1.ForbiddenError('Only veterinarians can update diagnoses');
        }
        const { diagnosis, labTests, severity, prognosis, observations, date } = req.body;
        // Verify diagnosis exists and was created by this vet
        const existingDiagnosis = await prisma_1.default.diagnosis.findFirst({
            where: {
                id: diagnosisId,
                recordedById: userId
            },
            include: {
                livestock: {
                    select: {
                        id: true,
                        tagId: true
                    }
                }
            }
        });
        if (!existingDiagnosis) {
            throw new NotFoundError_1.NotFoundError('Diagnosis not found or you do not have permission to edit it');
        }
        const updatedDiagnosis = await prisma_1.default.diagnosis.update({
            where: { id: diagnosisId },
            data: {
                diagnosis,
                labTests,
                severity,
                prognosis,
                observations,
                date: date ? new Date(date) : undefined
            },
            include: {
                recordedBy: {
                    select: {
                        id: true,
                        fullName: true,
                        role: true
                    }
                },
                livestock: {
                    select: {
                        id: true,
                        tagId: true,
                        type: true,
                        breed: true
                    }
                }
            }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Diagnosis updated successfully', { diagnosis: updatedDiagnosis });
    }
    catch (error) {
        next(error);
    }
};
exports.updateDiagnosis = updateDiagnosis;
const getLivestockDiagnoses = async (req, res, next) => {
    try {
        const livestockId = req.params.livestockId;
        // Verify livestock exists
        const livestock = await prisma_1.default.livestock.findUnique({
            where: {
                id: livestockId,
                isDeleted: false
            },
            select: {
                id: true,
                tagId: true,
                type: true
            }
        });
        if (!livestock) {
            throw new NotFoundError_1.NotFoundError('Livestock not found');
        }
        const diagnoses = await prisma_1.default.diagnosis.findMany({
            where: {
                livestockId
            },
            include: {
                recordedBy: {
                    select: {
                        id: true,
                        fullName: true,
                        role: true
                    }
                }
            },
            orderBy: {
                date: 'desc'
            }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Diagnoses retrieved successfully', {
            livestock,
            diagnoses,
            count: diagnoses.length
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getLivestockDiagnoses = getLivestockDiagnoses;
const getDiagnosis = async (req, res, next) => {
    try {
        const diagnosisId = req.params.diagnosisId;
        const diagnosis = await prisma_1.default.diagnosis.findUnique({
            where: { id: diagnosisId },
            include: {
                recordedBy: {
                    select: {
                        id: true,
                        fullName: true,
                        role: true
                    }
                },
                livestock: {
                    select: {
                        id: true,
                        tagId: true,
                        type: true,
                        breed: true,
                        gender: true
                    }
                }
            }
        });
        if (!diagnosis) {
            throw new NotFoundError_1.NotFoundError('Diagnosis not found');
        }
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Diagnosis retrieved successfully', { diagnosis });
    }
    catch (error) {
        next(error);
    }
};
exports.getDiagnosis = getDiagnosis;
const deleteDiagnosis = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const diagnosisId = req.params.diagnosisId;
        // Only VET can delete diagnosis
        if (userRole !== 'VET') {
            throw new ForbiddenError_1.ForbiddenError('Only veterinarians can delete diagnoses');
        }
        // Verify diagnosis exists and was created by this vet
        const existingDiagnosis = await prisma_1.default.diagnosis.findFirst({
            where: {
                id: diagnosisId,
                recordedById: userId
            }
        });
        if (!existingDiagnosis) {
            throw new NotFoundError_1.NotFoundError('Diagnosis not found or you do not have permission to delete it');
        }
        await prisma_1.default.diagnosis.delete({
            where: { id: diagnosisId }
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Diagnosis deleted successfully');
    }
    catch (error) {
        next(error);
    }
};
exports.deleteDiagnosis = deleteDiagnosis;
