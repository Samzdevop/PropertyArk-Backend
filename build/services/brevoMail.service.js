"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNodemailerTemplateMail = exports.sendNodemailerMail = exports.initializeTransporter = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const logger_1 = __importDefault(require("../config/logger"));
let transporter = null;
const initializeTransporter = () => {
    if (transporter) {
        return transporter;
    }
    try {
        if (process.env.SMTP_ENABLED === 'false') {
            logger_1.default.warn('SMTP is disabled by configuration');
            transporter = nodemailer_1.default.createTransport({
                jsonTransport: true,
            });
            return transporter;
        }
        // Validate required environment variables
        if (!process.env.SMTP_HOST) {
            throw new Error('SMTP_HOST is not set in environment variables');
        }
        if (!process.env.SMTP_USERNAME) {
            throw new Error('SMTP_USERNAME is not set in environment variables');
        }
        if (!process.env.SMTP_PASSWORD) {
            throw new Error('SMTP_PASSWORD is not set in environment variables');
        }
        // Create transporter with Brevo SMTP settings
        transporter = nodemailer_1.default.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USERNAME,
                pass: process.env.SMTP_PASSWORD,
            },
            // Optional: Add TLS options if needed
            tls: {
                rejectUnauthorized: false,
            },
            // Optional: Add pool settings for better performance
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
        });
        // Verify connection
        transporter.verify((error, success) => {
            if (error) {
                logger_1.default.error('SMTP transporter verification failed:', error);
                throw error;
            }
            if (success) {
                logger_1.default.info('SMTP transporter verified successfully');
            }
        });
        logger_1.default.info('Nodemailer transporter initialized with Brevo SMTP');
        return transporter;
    }
    catch (error) {
        logger_1.default.error('Failed to initialize Nodemailer transporter:', error);
        // Create a dummy transporter that logs instead of sending
        transporter = nodemailer_1.default.createTransport({
            jsonTransport: true,
        });
        return transporter;
    }
};
exports.initializeTransporter = initializeTransporter;
/**
 * Send email using Nodemailer with Brevo SMTP
 * Follows the same pattern as your existing sendGraphMail
 */
const sendNodemailerMail = async (mail) => {
    try {
        // Check if SMTP is enabled
        if (process.env.SMTP_ENABLED === 'false') {
            logger_1.default.info(`SMTP is disabled. Email would have been sent to ${mail.to}`);
            return;
        }
        // Initialize transporter if not already initialized
        const transporterInstance = (0, exports.initializeTransporter)();
        // Prepare email options
        const mailOptions = {
            from: mail.from || process.env.SENDER_EMAIL || 'noreply@propertymanagement.com',
            to: mail.to,
            subject: mail.subject,
            text: mail.text,
            html: mail.html,
            cc: mail.cc,
            bcc: mail.bcc,
            // Optional: Add custom headers
            headers: {
                'X-Application': 'Property Management',
                'X-Environment': process.env.NODE_ENV || 'development',
            },
        };
        const info = await transporterInstance.sendMail(mailOptions);
        logger_1.default.info(`Email sent successfully via Brevo SMTP to ${mail.to}. MessageId: ${info.messageId}`);
        if (transporterInstance.options.jsonTransport) {
            logger_1.default.info(`Email preview: ${info.messageId}`);
        }
    }
    catch (error) {
        logger_1.default.error(`Nodemailer email sending failed: ${error.message}`, error);
        throw new Error(`Failed to send email: ${error.message}`);
    }
};
exports.sendNodemailerMail = sendNodemailerMail;
const sendNodemailerTemplateMail = async (to, templateName, templateData, subject, from) => {
    try {
        const { render } = await Promise.resolve().then(() => __importStar(require('../utils/mailTemplate')));
        const html = await render(templateName, templateData);
        const text = html.replace(/<[^>]*>/g, '');
        const mailOptions = {
            to: to,
            from: from || process.env.SENDER_EMAIL || 'noreply@propertymanagement.com',
            subject: subject,
            text: text,
            html: html,
        };
        await (0, exports.sendNodemailerMail)(mailOptions);
        logger_1.default.info(`Template email sent via Nodemailer to ${to}. Template: ${templateName}`);
    }
    catch (error) {
        logger_1.default.error(`Nodemailer template email failed: ${error.message}`, error);
        throw new Error(`Failed to send template email: ${error.message}`);
    }
};
exports.sendNodemailerTemplateMail = sendNodemailerTemplateMail;
