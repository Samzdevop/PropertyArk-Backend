import { config } from './config';
import {  httpServer, io, } from './app';
import { ReminderJob } from './jobs/reminder.job';



const PORT = config.PORT;


httpServer.listen(PORT, () => {
  console.log(`🚀 Server + Socket.IO running on port ${PORT}`);
  ReminderJob.start();
});
