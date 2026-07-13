"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyResetToken = exports.generateResetToken = void 0;
const UnauthorizedError_1 = require("../errors/UnauthorizedError");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const generateToken = (user) => {
    return jsonwebtoken_1.default.sign({
        id: user.id,
        ...(user.email && { email: user.email }),
        ...(user.phone && { phone: user.phone })
    }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRY || '1h',
    });
};
exports.default = generateToken;
const generateResetToken = (email) => {
    return jsonwebtoken_1.default.sign({ email, type: 'password_reset' }, process.env.JWT_SECRET, { expiresIn: '1h' } // Token expires in 1 hour
    );
};
exports.generateResetToken = generateResetToken;
// Add this function to verify reset token
const verifyResetToken = (token) => {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        if (decoded.type !== 'password_reset') {
            throw new Error('Invalid token type');
        }
        return decoded;
    }
    catch (error) {
        throw new UnauthorizedError_1.UnauthorizedError('Invalid or expired reset token');
    }
};
exports.verifyResetToken = verifyResetToken;
