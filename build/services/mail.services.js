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
exports.testSMTPConnection = exports.sendTemplateMail = exports.sendGraphMail = void 0;
const brevoMail_service_1 = require("./brevoMail.service");
const logger_1 = __importDefault(require("../config/logger"));
const sendGraphMail = async (mail) => {
    try {
        if (process.env.SMTP_ENABLED === 'false') {
            logger_1.default.info('Email sending is disabled by configuration');
            return;
        }
        await (0, brevoMail_service_1.sendNodemailerMail)(mail);
        logger_1.default.info(`Email sent successfully to ${mail.to}`);
    }
    catch (error) {
        logger_1.default.error('Failed to send email:', error);
        throw new Error('Failed to send email');
    }
};
exports.sendGraphMail = sendGraphMail;
const sendTemplateMail = async (to, templateName, templateData, subject, from) => {
    try {
        await (0, brevoMail_service_1.sendNodemailerTemplateMail)(to, templateName, templateData, subject, from);
    }
    catch (error) {
        logger_1.default.error(`Failed to send template email: ${error}`);
        throw new Error(`Failed to send template email: ${error}`);
    }
};
exports.sendTemplateMail = sendTemplateMail;
const testSMTPConnection = async () => {
    try {
        const { initializeTransporter } = await Promise.resolve().then(() => __importStar(require('./brevoMail.service')));
        const transporter = initializeTransporter();
        await transporter.verify();
        logger_1.default.info('SMTP connection test successful');
        return true;
    }
    catch (error) {
        logger_1.default.error('SMTP connection test failed:', error);
        return false;
    }
};
exports.testSMTPConnection = testSMTPConnection;
