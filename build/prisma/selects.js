"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.livestockSelect = exports.userSelect = void 0;
exports.userSelect = {
    id: true,
    fullName: true,
    email: true,
    phone: true,
    // password: false,
    // isSuspended: false,
    companyName: true,
    role: true,
    isVerified: true,
    avatar: true,
    location: true,
    createdAt: true,
    updatedAt: true,
    lastLogin: true,
    companyId: true
};
exports.livestockSelect = {
    id: true,
    tagId: true,
    type: true,
    breed: true,
    birthDate: true,
    healthStatus: true,
    weight: true,
    gender: true,
    livestockSource: true,
    livestockPurpose: true,
    isSick: true,
    isTreatment: true,
    isDeleted: true,
    deletionReason: true,
    deletedAt: true,
    addedById: true,
    updatedById: true,
    companyId: true,
};
