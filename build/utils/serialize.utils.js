"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeDates = void 0;
const serializeDates = (obj) => {
    if (!obj)
        return obj;
    if (Array.isArray(obj)) {
        return obj.map(item => (0, exports.serializeDates)(item));
    }
    if (obj instanceof Date) {
        return obj.toISOString();
    }
    if (typeof obj === 'object' && obj !== null) {
        const result = {};
        for (const key in obj) {
            result[key] = (0, exports.serializeDates)(obj[key]);
        }
        return result;
    }
    return obj;
};
exports.serializeDates = serializeDates;
