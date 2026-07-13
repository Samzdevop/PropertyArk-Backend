"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSuccessResponse = void 0;
const sendSuccessResponse = (res, message = '', data = {}, statusCode = 200) => {
    return res.status(statusCode).json({ success: true, message, data });
};
exports.sendSuccessResponse = sendSuccessResponse;
