import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { formatCurrency, formatDate } from './date.utils';

handlebars.registerHelper('eq', (a, b) => a === b);
handlebars.registerHelper('neq', (a, b) => a !== b);
handlebars.registerHelper('formatDate', (date) => formatDate(new Date(date)));
handlebars.registerHelper('formatCurrency', (amount) => formatCurrency(amount));

export const render = async (
  templateName: string,
  data: Record<string, any>
): Promise<string> => {
  const filePath = path.join(__dirname, '../views', `${templateName}.hbs`);
  const templateContent = await fs.readFileSync(filePath, 'utf8');
  const template = handlebars.compile(templateContent);
  return template(data);
};




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