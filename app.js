const createError = require("http-errors");

const express = require("express");
const fileUpload = require("express-fileupload");
const session = require("express-session");

const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");

const indexRouter = require("./routes/index");
const apiRouter = require("./routes/api");
const adminRouter = require("./routes/admin");
const deckRouter = require("./routes/decks");

const app = express();

const session_store = require("./session.js");
const config = require("./config.json");

const db = require("./db");
const authenticator = require("./middleware/authenticator");

global.rootDirectory = path.resolve(__dirname);

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
