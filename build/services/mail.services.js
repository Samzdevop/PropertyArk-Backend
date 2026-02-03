"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendCustomMail = exports.transporter = void 0;
const logger_1 = __importDefault(require("../config/logger"));
const nodemailer_1 = __importDefault(require("nodemailer"));
exports.transporter = nodemailer_1.default.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD,
    },
});
const sendCustomMail = async (mailOptions) => {
    try {
        const info = await exports.transporter.sendMail(mailOptions);
        logger_1.default.info(`Mail successfully sent to ${mailOptions.to}`);
        logger_1.default.info('Message sent: %s', info);
    }
    catch (error) {
        logger_1.default.info(`Error sending message to ${mailOptions.to}`);
        logger_1.default.error('Error sending email:', error);
    }
};
exports.sendCustomMail = sendCustomMail;
