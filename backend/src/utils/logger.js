const info = (message, meta = "") => {
  console.log("[INFO]", message, meta);
};

const error = (message, meta = "") => {
  console.error("[ERROR]", message, meta);
};

module.exports = {
  info,
  error,
};
