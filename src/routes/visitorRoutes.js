const express = require("express");
const router = express.Router();
const visitorController = require("../controller/totalVisitsController");

// Register a new visit
router.post("/register", visitorController.registerVisit);

// Get all total visitors data
router.get("/total", visitorController.getTotalVisitors);

// Get peak time average
router.get("/peak-time", visitorController.getPeakTimeAverage);

module.exports = router;

