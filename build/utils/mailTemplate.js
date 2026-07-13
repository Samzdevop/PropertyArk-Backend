"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.render = void 0;
const handlebars_1 = __importDefault(require("handlebars"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const date_utils_1 = require("./date.utils");
handlebars_1.default.registerHelper('eq', (a, b) => a === b);
handlebars_1.default.registerHelper('neq', (a, b) => a !== b);
handlebars_1.default.registerHelper('formatDate', (date) => (0, date_utils_1.formatDate)(new Date(date)));
handlebars_1.default.registerHelper('formatCurrency', (amount) => (0, date_utils_1.formatCurrency)(amount));
const render = async (templateName, data) => {
    const filePath = path_1.default.join(__dirname, '../views', `${templateName}.hbs`);
    const templateContent = await fs_1.default.readFileSync(filePath, 'utf8');
    const template = handlebars_1.default.compile(templateContent);
    return template(data);
};
exports.render = render;
// import handlebars from 'handlebars';
// import fs from 'fs';
// import path from 'path';
// export const render = (
// 	templateName: string,
// 	data: Record<string, any>
// ): string => {
// 	const filePath = path.join(__dirname, '../views', `${templateName}.hbs`);
// 	const templateContent = fs.readFileSync(filePath, 'utf8');
// 	const template = handlebars.compile(templateContent);
// 	return template(data);
// };
// // const render = (templateName, data = {}) => {
// // 	const filePath = path.join(__dirname, 'views', `${templateName}.hbs`);
// // 	const templateContent = fs.readFileSync(filePath, 'utf8');
// // 	const template = handlebars.compile(templateContent);
// // 	return template(data);
// // };
