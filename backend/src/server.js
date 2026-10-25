require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");
const logger = require("./utils/logger");
const { startScheduler } = require("./jobs/notificationScheduler");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  const initDepartments = require("./utils/initDepartments");
  await initDepartments();
  startScheduler();

  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
};

startServer();
