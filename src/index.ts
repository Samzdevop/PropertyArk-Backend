import { config } from './config';
import { app } from './app';
import Logger from './config/logger';
import { SocketService } from './services/socket.service';
import { KeyManager } from './utils/keyManager.util';
import { KeyRotationJob } from './jobs/keyRotation.job';
import { pdfGenerator } from './services/pdf.service';

const PORT = config.PORT;
let server: any = null;

const gracefulShutdown = async (signal: string): Promise<void> => {
  Logger.info(`${signal} received. Starting graceful shutdown...`);

  const forceShutdownTimeout = setTimeout(() => {
    Logger.error('Graceful shutdown timeout. Forcefully terminating...');
    process.exit(1);
  }, 30000);

  try {
    // Close HTTP server
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err: Error | undefined) => {
          if (err) reject(err);
          else {
            Logger.info('HTTP server closed');
            resolve();
          }
        });
      });
    }

    // Close Socket.IO
    try {
      SocketService.getIO().close();
      Logger.info('Socket.IO server closed');
    } catch (error) {
      // Socket might not be initialized
    }

    // Close PDF browser
    try {
      await pdfGenerator.closeBrowser();
      Logger.info('PDF browser closed');
    } catch (error) {
      // PDF browser might not be initialized
    }

    clearTimeout(forceShutdownTimeout);
    Logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    Logger.error('Error during graceful shutdown:', error);
    clearTimeout(forceShutdownTimeout);
    process.exit(1);
  }
};

// Initialize encryption
try {
  KeyManager.initialize();
  Logger.info('Encryption initialized successfully');
} catch (error: any) {
  Logger.error('Failed to initialize encryption:', error.message);
  process.exit(1);
}

server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  
  // Start key rotation job
  KeyRotationJob.start();
});

// Initialize Socket.IO
SocketService.initialize(server);

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  Logger.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  Logger.error('Unhandled Rejection:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});




// import { app } from './app';
// import { config } from './config';

// let server: any = null;

// const PORT = config.PORT;


// server = app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });
