import createError from "http-errors";

import express from "express";
import fileUpload from "express-fileupload";
import session from "express-session";

import path from "path";
import cookieParser from "cookie-parser";
import logger from "morgan";

import indexRouter from "./routes/index";
import apiRouter from "./routes/api";
import adminRouter from "./routes/admin";
import deckRouter from "./routes/decks";

const app = express();

import session_store from "./session.js";
import config from "./config.json";

import db from "./db";
import authenticator from "./middleware/authenticator";

declare var rootDirectory = path.resolve(__dirname);

db.setupPool();
db.transact("SELECT NOW()").then((result) => {
  console.log(result.rows[0]);
});

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: config.session_secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 30,
    },
    store: session_store,
  })
);
app.use(authenticator);

app.use("/", indexRouter);
app.use("/api", apiRouter);
app.use("/admin", adminRouter);
app.use("/decks", deckRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
