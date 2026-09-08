import { app } from "./app.js";
import { env } from "./utils/env.js";
import { startDailyNotificationSyncJob } from "./jobs/dailyNotificationSync.job.js";

app.listen(env.port, () => {
  console.log(`Server listening on http://localhost:${env.port}`);
  startDailyNotificationSyncJob();
});
