var express = require("express");
var router = express.Router();

router.get("/token", function (req, res, next) {
  res.status(200).json({}).end();
});

router.post("/comments", function (req, res, next) {
  res.status(200).json({}).end();
});

router.put("/comments", function (req, res, next) {
  res.status(200).json({}).end();
});

router.delete("/comments", function (req, res, next) {
  res.status(200).json({}).end();
});

router.put("/login", function (req, res, next) {
  res.status(200).json({}).end();
});

router.put("/vote", function (req, res, next) {
  res.status(200).json({}).end();
});

router.post("/answers", function (req, res, next) {
  res.status(200).json({}).end();
});

router.delete("/answers", function (req, res, next) {
  res.status(200).json({}).end();
});

module.exports = router;
