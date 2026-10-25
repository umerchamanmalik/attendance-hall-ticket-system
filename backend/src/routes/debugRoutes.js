const express = require("express");
const { clearUsers } = require("../controllers/debugController");

const router = express.Router();

router.post("/clear-users", clearUsers);

module.exports = router;
