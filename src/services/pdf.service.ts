// services/pdf.service.ts
import puppeteer, { Browser } from 'puppeteer';
import Logger from '../config/logger';
import { render } from '../utils/mailTemplate';

interface PDFOptions {
  format?: 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal' | 'Tabloid';
  landscape?: boolean;
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  timeout?: number;
  printBackground?: boolean;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
}

interface GeneratePDFResult {
  buffer: Buffer;
  size: number;
  generatedAt: Date;
  pages?: number;
}

class PDFGenerator {
  private static instance: PDFGenerator;
  private browser: Browser | null = null;
  private isInitializing = false;
  private initPromise: Promise<Browser> | null = null;

  private readonly launchOptions = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--font-render-hinting=none',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    ...(process.env.NODE_ENV === 'production' && {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--font-render-hinting=none',
        '--single-process',
        '--no-zygote',
      ],
    }),
  };

  private constructor() {}

  static getInstance(): PDFGenerator {
    if (!PDFGenerator.instance) {
      PDFGenerator.instance = new PDFGenerator();
    }
    return PDFGenerator.instance;
  }

  /**
   * Initialize browser with retry logic
   * ✅ Fixed: Use 'connected' instead of 'isConnected'
   */
  async initializeBrowser(): Promise<Browser> {
    // Already initialized and connected
    if (this.browser?.connected) {
      return this.browser;
    }

    // Currently initializing - wait for existing promise
    if (this.isInitializing && this.initPromise) {
      return this.initPromise;
    }

    this.isInitializing = true;
    this.initPromise = (async () => {
      try {
        Logger.info('Initializing PDF browser...');
        this.browser = await puppeteer.launch(this.launchOptions);
        
        // Handle browser disconnection
        this.browser.on('disconnected', () => {
          Logger.warn('PDF browser disconnected');
          this.browser = null;
        });

        Logger.info('PDF browser initialized successfully');
        return this.browser;
      } catch (error) {
        Logger.error('Failed to initialize PDF browser:', error);
        this.browser = null;
        throw new Error('PDF generation service unavailable');
      } finally {
        this.isInitializing = false;
      }
    })();

    return this.initPromise;
  }

  /**
   * Generate PDF from HTML string
   * ✅ Fixed: Use 'load' instead of 'networkidle0' for TypeScript compatibility
   */
  async generatePDF(
    html: string,
    options: PDFOptions = {}
  ): Promise<GeneratePDFResult> {
    const browser = await this.initializeBrowser();
    const page = await browser.newPage();
    const startTime = Date.now();

    try {
      // Set viewport
      await page.setViewport({
        width: 1200,
        height: 800,
        deviceScaleFactor: 2,
      });

      // ✅ Fixed: Use 'load' with timeout instead of 'networkidle0'
      await page.setContent(html, {
        waitUntil: 'load',
        timeout: options.timeout || 30000,
      });

      // Wait for fonts and images to load
      await page.evaluate(() => {
        return new Promise((resolve) => {
          if (document.readyState === 'complete') {
            resolve(true);
          } else {
            window.addEventListener('load', () => resolve(true));
          }
        });
      });

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: options.format || 'A4',
        landscape: options.landscape ?? false,
        printBackground: options.printBackground ?? true,
        margin: {
          top: options.margin?.top || '0.5in',
          right: options.margin?.right || '0.5in',
          bottom: options.margin?.bottom || '0.5in',
          left: options.margin?.left || '0.5in',
        },
        displayHeaderFooter: options.displayHeaderFooter ?? false,
        headerTemplate: options.headerTemplate,
        footerTemplate: options.footerTemplate,
        preferCSSPageSize: true,
      });

      const generationTime = Date.now() - startTime;
      const sizeInKB = (pdfBuffer.length / 1024).toFixed(2);
      
      Logger.info(
        `PDF generated in ${generationTime}ms, size: ${sizeInKB}KB, format: ${options.format || 'A4'}`
      );

      // Get page count (approximate)
      const pageCount = await page.evaluate(() => {
        return document.querySelectorAll('.page').length || 1;
      });

      return {
        buffer: Buffer.from(pdfBuffer),
        size: pdfBuffer.length,
        generatedAt: new Date(),
        pages: pageCount,
      };
    } catch (error) {
      Logger.error('PDF generation failed:', error);
      throw new Error('Failed to generate PDF document');
    } finally {
      await page.close().catch(() => {});
    }
  }

  /**
   * Generate PDF from a Handlebars template
   */
  async generatePDFFromTemplate(
    templateName: string,
    data: Record<string, any>,
    options?: PDFOptions
  ): Promise<GeneratePDFResult> {
    try {
      const html = await render(templateName, data);
      return this.generatePDF(html, options);
    } catch (error) {
      Logger.error(`Failed to generate PDF from template ${templateName}:`, error);
      throw error;
    }
  }

  /**
   * Generate PDF from URL
   * ✅ Fixed: Use 'load' instead of 'networkidle0'
   */
  async generatePDFFromURL(
    url: string,
    options: PDFOptions = {}
  ): Promise<GeneratePDFResult> {
    const browser = await this.initializeBrowser();
    const page = await browser.newPage();
    const startTime = Date.now();

    try {
      await page.goto(url, {
        waitUntil: 'load',
        timeout: options.timeout || 30000,
      });

      const pdfBuffer = await page.pdf({
        format: options.format || 'A4',
        landscape: options.landscape ?? false,
        printBackground: options.printBackground ?? true,
        margin: {
          top: options.margin?.top || '0.5in',
          right: options.margin?.right || '0.5in',
          bottom: options.margin?.bottom || '0.5in',
          left: options.margin?.left || '0.5in',
        },
      });

      const generationTime = Date.now() - startTime;
      Logger.info(`PDF generated from URL in ${generationTime}ms`);

      return {
        buffer: Buffer.from(pdfBuffer),
        size: pdfBuffer.length,
        generatedAt: new Date(),
      };
    } catch (error) {
      Logger.error('PDF generation from URL failed:', error);
      throw new Error('Failed to generate PDF from URL');
    } finally {
      await page.close().catch(() => {});
    }
  }

  /**
   * Close the browser
   * ✅ Fixed: Use 'connected' instead of 'isConnected'
   */
  async closeBrowser(): Promise<void> {
    if (this.browser?.connected) {
      try {
        await this.browser.close();
        Logger.info('PDF browser closed');
      } catch (error) {
        Logger.error('Error closing PDF browser:', error);
      }
    }
    this.browser = null;
    this.initPromise = null;
  }

  /**
   * Restart the browser (useful for memory issues)
   */
  async restartBrowser(): Promise<void> {
    await this.closeBrowser();
    await this.initializeBrowser();
    Logger.info('PDF browser restarted');
  }

  /**
   * Check if browser is healthy
   * ✅ Fixed: Use 'connected' instead of 'isConnected'
   */
  isHealthy(): boolean {
    return this.browser !== null && this.browser.connected;
  }

  /**
   * Get browser status
   * ✅ Fixed: Use 'connected' instead of 'isConnected'
   */
  getStatus(): { isConnected: boolean; isInitializing: boolean } {
    return {
      isConnected: this.browser?.connected ?? false,
      isInitializing: this.isInitializing,
    };
  }
}

export const pdfGenerator = PDFGenerator.getInstance();