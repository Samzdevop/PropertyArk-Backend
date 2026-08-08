"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDateForDB = exports.parseDate = exports.formatCurrency = exports.formatDate = void 0;
const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};
exports.formatDate = formatDate;
const formatCurrency = (amount) => {
    return amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};
exports.formatCurrency = formatCurrency;
const parseDate = (dateString) => {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
        return date;
    }
    const simpleDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (simpleDateRegex.test(dateString)) {
        const parts = dateString.split('-').map(Number);
        const parsedDate = new Date(parts[0], parts[1] - 1, parts[2]);
        if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
        }
    }
    throw new Error(`Invalid date format: ${dateString}`);
};
exports.parseDate = parseDate;
const formatDateForDB = (date) => {
    return new Date(date.setHours(0, 0, 0, 0));
};
exports.formatDateForDB = formatDateForDB;
