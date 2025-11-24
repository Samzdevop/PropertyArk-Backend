import { ReminderService } from '../services/reminderService';
import cron from 'node-cron';


export class ReminderJob {
  static start() {
    // Run every minute to check for due reminders
    cron.schedule('* * * * *', async () => {
      console.log('⏰ Running reminder check...');
      await ReminderService.checkDueReminders();
    });

     cron.schedule('0 2 * * *', async () => {
      console.log(' Cleaning up old reminders...');
      await ReminderService.cleanupOldReminders();
    });

    console.log('✅ Reminder cronjob started - checking every minute');
  }
}