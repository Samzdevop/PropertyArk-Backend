"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const app_1 = require("./app");
const reminder_job_1 = require("./jobs/reminder.job");
const PORT = config_1.config.PORT;
app_1.httpServer.listen(PORT, () => {
    console.log(`🚀 Server + Socket.IO running on port ${PORT}`);
    reminder_job_1.ReminderJob.start();
});
