const cron = require("node-cron");
const {
  checkUpcomingExamsAndNotify,
} = require("../services/examReminderService");

let schedulerStarted = false;

const startScheduler = () => {
  if (schedulerStarted) {
    return;
  }

  schedulerStarted = true;

  cron.schedule("0 9 * * *", async () => {
    try {
      await checkUpcomingExamsAndNotify();
    } catch (error) {
      console.error("❌ Scheduled notification job failed:", error.message);
    }
  });

  setTimeout(async () => {
    try {
      await checkUpcomingExamsAndNotify();
    } catch (error) {
      console.error("❌ Startup notification check failed:", error.message);
    }
  }, 30000);

  console.log("✅ Notification scheduler started");
};

module.exports = {
  startScheduler,
  checkUpcomingExamsAndNotify,
};
