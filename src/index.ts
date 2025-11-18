import { config } from './config';
import { app } from './app';
import { ReminderJob } from './jobs/reminder.job';

const PORT = config.PORT;

app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
	ReminderJob.start();
});