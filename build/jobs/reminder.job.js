"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReminderJob = void 0;
const reminderService_1 = require("../services/reminderService");
const node_cron_1 = __importDefault(require("node-cron"));
class ReminderJob {
    static start() {
        // Run every minute to check for due reminders
        node_cron_1.default.schedule('* * * * *', async () => {
            console.log('⏰ Running reminder check...');
            await reminderService_1.ReminderService.checkDueReminders();
        });
        node_cron_1.default.schedule('0 2 * * *', async () => {
            console.log(' Cleaning up old reminders...');
            await reminderService_1.ReminderService.cleanupOldReminders();
        });
        console.log('✅ Reminder cronjob started - checking every minute');
    }
}
exports.ReminderJob = ReminderJob;
