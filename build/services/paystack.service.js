"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaystackService = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = __importDefault(require("../config/logger"));
const BadRequestError_1 = require("../errors/BadRequestError");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class PaystackService {
    //   private static readonly BASE_URL = 'https://api.paystack.co';
    static getBaseUrl() {
        const url = process.env.PAYSTACK_BASE_URL;
        if (!url) {
            throw new Error('PAYSTACK_BASE_URL is not set');
        }
        return url;
    }
    static getSecretKey() {
        const key = process.env.PAYSTACK_SECRET_KEY;
        if (!key) {
            throw new Error('PAYSTACK_SECRET_KEY is not set');
        }
        return key;
    }
    static getHeaders() {
        return {
            'Authorization': `Bearer ${this.getSecretKey()}`,
            'Content-Type': 'application/json'
        };
    }
    static async initializeTransaction(data) {
        try {
            const response = await axios_1.default.post(`${this.getBaseUrl()}/transaction/initialize`, {
                email: data.email,
                amount: Math.round(data.amount * 100),
                reference: data.reference,
                callback_url: data.callback_url,
                metadata: data.metadata
            }, { headers: this.getHeaders() });
            logger_1.default.info(`Paystack transaction initialized: ${data.reference}`);
            return response.data.data;
        }
        catch (error) {
            logger_1.default.error('Paystack initialization failed:', error.response?.data || error.message);
            throw new BadRequestError_1.BadRequestError(error.response?.data?.message || 'Failed to initialize payment');
        }
    }
    static async verifyTransaction(reference) {
        try {
            const response = await axios_1.default.get(`${this.getBaseUrl()}/transaction/verify/${reference}`, { headers: this.getHeaders() });
            logger_1.default.info(`Paystack transaction verified: ${reference}`);
            return response.data.data;
        }
        catch (error) {
            logger_1.default.error('Paystack verification failed:', error.response?.data || error.message);
            throw new BadRequestError_1.BadRequestError(error.response?.data?.message || 'Failed to verify payment');
        }
    }
    static validateWebhookSignature(payload, signature) {
        const crypto = require('crypto');
        const secretKey = this.getSecretKey();
        const hash = crypto
            .createHmac('sha512', secretKey)
            .update(payload)
            .digest('hex');
        return hash === signature;
    }
}
exports.PaystackService = PaystackService;
