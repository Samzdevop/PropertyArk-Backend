"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
console.log('Environment loaded:', process.env.JWT_SECRET ? 'Yes' : 'No');
dotenv_1.default.config();
exports.config = {
    PORT: process.env.PORT || 5000,
};
