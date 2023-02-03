import createError from "http-errors";

import express from "express";
import { Request, Response, NextFunction } from "express";

import session from "express-session";

import path from "path";
import cookieParser from "cookie-parser";
import logger from "morgan";

import indexRouter from "./frontend/routes/index";
import apiRouter from "./backend/routes/api";
import adminRouter from "./frontend/routes/admin";
import deckRouter from "./frontend/routes/decks";

const app = express();

import session_store from "./backend/session";
import config from "../config.json";

import authenticator from "./backend/middleware/authenticator";
import database from "./backend/database";

import legacyFeedbackSetup from "./backend/legacy.feedback";

import cors from "cors";

const corsOptions: cors.CorsOptions = {
  credentials: true,
  origin: true,
  preflightContinue: true,
};

global.rootDirectory = path.resolve(__dirname);

legacyFeedbackSetup();

// view engine setup
app.set("views", path.join(__dirname, "frontend", "views"));
app.set("view engine", "pug");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "frontend", "static")));
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
app.use("/api", cors(), apiRouter);
app.use("/admin", adminRouter);
app.use("/decks", deckRouter);

// catch 404 and forward to error handler
app.use(function (req: Request, res: Response, next: NextFunction) {
  next(createError(404));
});

// error handler
app.use(function (
  error: any,
  request: Request,
  response: Response,
  next: NextFunction
) {
  // set locals, only providing error in development
  response.locals.message = error.message;
  response.locals.error = request.app.get("env") === "development" ? error : {};

  // render the error page
  response.status(error.status || 500);
  response.render("error");
});

database.query("SELECT NOW()").then((result) => {
  console.log("[APPLICATION] Database Time:", result.rows[0].now);
});

export default app;
