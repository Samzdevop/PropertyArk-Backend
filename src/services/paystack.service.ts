import axios from 'axios';
import Logger from '../config/logger';
import { BadRequestError } from '../errors/BadRequestError';
import dontev from "dotenv";
dontev.config();

export class PaystackService {
//   private static readonly BASE_URL = 'https://api.paystack.co';

    private static getBaseUrl(): string {
        const url = process.env.PAYSTACK_BASE_URL;

        if (!url) {
        throw new Error('PAYSTACK_BASE_URL is not set');
        }

        return url;
    }
  
    private static getSecretKey(): string {
        const key = process.env.PAYSTACK_SECRET_KEY;
        if (!key) {
        throw new Error('PAYSTACK_SECRET_KEY is not set');
        }
        return key;
    }

    private static getHeaders(): any {
        return {
        'Authorization': `Bearer ${this.getSecretKey()}`,
        'Content-Type': 'application/json'
        };
    }


    static async initializeTransaction(data: {
        email: string;
        amount: number; 
        reference: string;
        callback_url?: string;
        metadata?: any;
    }): Promise<any> {
        try {
        const response = await axios.post(
            `${this.getBaseUrl()}/transaction/initialize`,
            {
            email: data.email,
            amount: Math.round(data.amount * 100),
            reference: data.reference,
            callback_url: data.callback_url,
            metadata: data.metadata
            },
            { headers: this.getHeaders() }
        );

        Logger.info(`Paystack transaction initialized: ${data.reference}`);
        return response.data.data;
        } catch (error: any) {
        Logger.error('Paystack initialization failed:', error.response?.data || error.message);
        throw new BadRequestError(
            error.response?.data?.message || 'Failed to initialize payment'
        );
        }
    }

    
    static async verifyTransaction(reference: string): Promise<any> {
        try {
        const response = await axios.get(
            `${this.getBaseUrl()}/transaction/verify/${reference}`,
            { headers: this.getHeaders() }
        );

        Logger.info(`Paystack transaction verified: ${reference}`);
        return response.data.data;
        } catch (error: any) {
        Logger.error('Paystack verification failed:', error.response?.data || error.message);
        throw new BadRequestError(
            error.response?.data?.message || 'Failed to verify payment'
        );
        }
    }

    static validateWebhookSignature(
        payload: string,
        signature: string
    ): boolean {
        const crypto = require('crypto');
        const secretKey = this.getSecretKey();
        const hash = crypto
        .createHmac('sha512', secretKey)
        .update(payload)
        .digest('hex');
        
        return hash === signature;
    }
}