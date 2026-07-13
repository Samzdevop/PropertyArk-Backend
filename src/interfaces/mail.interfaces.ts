export interface MailInterface {
	from: string;
	to: string | string[];
	subject: string;
	cc?: string | string[];
	bcc?: string | string[];
	text: string;
	html?: string;
	attachments?: Array<{
		content?: string;
		name?: string;
		url?: string;
	}>;
}