import nodemailer, { Transporter } from 'nodemailer';
import Logger from '../config/logger';
import { MailInterface } from '../interfaces/mail.interfaces';

let transporter: Transporter | null = null;


export const initializeTransporter = (): Transporter => {
  if (transporter) {
    return transporter;
  }

  try {
    if (process.env.SMTP_ENABLED === 'false') {
      Logger.warn('SMTP is disabled by configuration');
      transporter = nodemailer.createTransport({
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
    transporter = nodemailer.createTransport({
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
        Logger.error('SMTP transporter verification failed:', error);
        throw error;
      }
      if (success) {
        Logger.info('SMTP transporter verified successfully');
      }
    });

    Logger.info('Nodemailer transporter initialized with Brevo SMTP');
    return transporter;
  } catch (error: any) {
    Logger.error('Failed to initialize Nodemailer transporter:', error);
    // Create a dummy transporter that logs instead of sending
    transporter = nodemailer.createTransport({
      jsonTransport: true,
    });
    return transporter;
  }
};

/**
 * Send email using Nodemailer with Brevo SMTP
 * Follows the same pattern as your existing sendGraphMail
 */
export const sendNodemailerMail = async (mail: MailInterface): Promise<void> => {
  try {
    // Check if SMTP is enabled
    if (process.env.SMTP_ENABLED === 'false') {
      Logger.info(`SMTP is disabled. Email would have been sent to ${mail.to}`);
      return;
    }

    // Initialize transporter if not already initialized
    const transporterInstance = initializeTransporter();

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
    
    Logger.info(`Email sent successfully via Brevo SMTP to ${mail.to}. MessageId: ${info.messageId}`);
    
    if ((transporterInstance.options as any).jsonTransport) {
      Logger.info(`Email preview: ${info.messageId}`);
    }
  } catch (error: any) {
    Logger.error(`Nodemailer email sending failed: ${error.message}`, error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

export const sendNodemailerTemplateMail = async (
  to: string | string[],
  templateName: string,
  templateData: Record<string, any>,
  subject: string,
  from?: string
): Promise<void> => {
  try {
    const { render } = await import('../utils/mailTemplate');

    const html = await render(templateName, templateData);

    const text = html.replace(/<[^>]*>/g, '');

    const mailOptions: MailInterface = {
      to: to,
      from: from || process.env.SENDER_EMAIL || 'noreply@propertymanagement.com',
      subject: subject,
      text: text,
      html: html,
    };

    await sendNodemailerMail(mailOptions);
    
    Logger.info(`Template email sent via Nodemailer to ${to}. Template: ${templateName}`);
  } catch (error: any) {
    Logger.error(`Nodemailer template email failed: ${error.message}`, error);
    throw new Error(`Failed to send template email: ${error.message}`);
  }
};