import { sendNodemailerMail, sendNodemailerTemplateMail } from './brevoMail.service';
import Logger from '../config/logger';
import { MailInterface } from '../interfaces/mail.interfaces';

export const sendGraphMail = async (mail: MailInterface): Promise<void> => {
  try {
    if (process.env.SMTP_ENABLED === 'false') {
      Logger.info('Email sending is disabled by configuration');
      return;
    }

    await sendNodemailerMail(mail);
    
    Logger.info(`Email sent successfully to ${mail.to}`);
  } catch (error) {
    Logger.error('Failed to send email:', error);
    throw new Error('Failed to send email');
  }
};


export const sendTemplateMail = async (
  to: string | string[],
  templateName: string,
  templateData: Record<string, any>,
  subject: string,
  from?: string
): Promise<void> => {
  try {
    await sendNodemailerTemplateMail(to, templateName, templateData, subject, from);
  } catch (error) {
    Logger.error(`Failed to send template email: ${error}`);
    throw new Error(`Failed to send template email: ${error}`);
  }
};


export const testSMTPConnection = async (): Promise<boolean> => {
  try {
    
    const { initializeTransporter } = await import('./brevoMail.service');
    
    const transporter = initializeTransporter();
  
    await transporter.verify();
    
    Logger.info('SMTP connection test successful');
    return true;
  } catch (error) {
    Logger.error('SMTP connection test failed:', error);
    return false;
  }
};