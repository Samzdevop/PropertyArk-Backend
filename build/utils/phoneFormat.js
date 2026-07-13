"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePhoneNumber = exports.normalizePhoneNumber = void 0;
const normalizePhoneNumber = (phone) => {
    // Remove all non-digit characters except leading +
    const cleaned = phone.replace(/[^\d+]/g, '');
    // If starts with +, assume valid international format
    if (cleaned.startsWith('+')) {
        return cleaned;
    }
    // Handle local Nigerian numbers (0...)
    if (cleaned.startsWith('0') && cleaned.length === 11) {
        return `+234${cleaned.substring(1)}`;
    }
    // Handle numbers without country code (default to Nigeria +234)
    if (/^[0-9]{10,15}$/.test(cleaned)) {
        return `+234${cleaned}`;
    }
    // Return as is (will fail validation)
    return phone;
};
exports.normalizePhoneNumber = normalizePhoneNumber;
const validatePhoneNumber = (phone) => {
    // General international phone number validation (E.164 format)
    const internationalRegex = /^\+[1-9]\d{1,14}$/;
    // Nigerian local format
    const localNigeriaRegex = /^0[0-9]{10}$/;
    return internationalRegex.test(phone) || localNigeriaRegex.test(phone);
};
exports.validatePhoneNumber = validatePhoneNumber;
