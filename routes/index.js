const express = require("express");
const router = express.Router();

const path = require("path");
const fs = require("fs");
const db = require("../db");
const cache = require("../cache");
const { render } = require("pug");
const Errors = require("../types/errors");

/* GET home page. */
router.get("/", async function (req, res, next) {
  let cookiestrings = [];
  if (req.cookies) {
    for (let parameter in req.cookies) {
      cookiestrings.push(`${parameter}: ${req.cookies[parameter]}`);
    }
  }
  cache.authenticate(req, (error, account) => {
    if (error) {
      return res.render("index", { title: "Decker", user: undefined });
    }
    res.render("index", {
      title: "Decker",
      admin: false,
      user: {
        username: account.username,
      },
    });
  });
});

router.get("/home", async function (req, res, next) {
  cache.authenticate(req, (error, account) => {
    if (error) {
      if (error === Errors.USER_NOT_FOUND) {
        res.redirect("/");
      } else if (error === Errors.AUTH_FAILED) {
        res.render("error", {
          message: "Benutzername und Passwort falsch.",
          error: {
            status: 403,
            stack: "",
          },
        });
      }
      //      res.render("error", { error: error });
    } else {
      account.getProjects((projects) => {
        account.hasRole("admin", (error, admin) => {
          if (error) {
            res.render("error");
            return;
          }
          if (admin) {
            res.render("projects", {
              title: "Decker Projektübersicht",
              admin: true,
              user: { username: account.username },
              projects: projects,
            });
          } else {
            res.render("projects", {
              title: "Decker Projektübersicht",
              admin: false,
              user: { username: account.username },
              projects: projects,
            });
          }
        });
      });
    }
  });
});

router.get("/video", async function (req, res, next) {
  let filepath = req.query.filepath;
  if (!filepath || filepath === "" || /\.\.(\/|\\)/g.test(filepath)) {
    return res.render("error", {
      message: "Video nicht oder fehlerhaft spezifiziert.",
    });
  }
  cache.authenticate(req, (error, account) => {
    if (error) {
      return res.render("error", {
        message: "Nicht Authentifiziert",
        error: {
          status: 401,
          stack: "No Stack",
        },
      });
    }
    if (account) {
      let userdir = account.getUserDirectory();
      userdir = path.resolve(userdir);
      const fullpath = userdir + "/" + filepath;
      const filename = path.basename(fullpath, path.extname(fullpath));
      const dirname = path.dirname(fullpath);
      const subtitles = filename + ".vtt";
      const vttfile = `${dirname}/${subtitles}`;
      let vttcontent = undefined;
      if (fs.existsSync(vttfile)) {
        vttcontent = fs.readFileSync(vttfile, { encoding: "utf8", flag: "r" });
      }
      return res.render("video", {
        user: { username: account.username },
        video: {
          url: `/decks/${account.username}/${filepath}`,
          path: filepath,
          vtt: vttcontent,
        },
      });
    } else {
      return res.render("error", {
        message: "Interner fehler.",
        error: {
          status: 500,
          stack: "No Stack",
        },
      });
    }
  });
});

router.get("/data-protection", async function (req, res, next) {
  cache.authenticate(req, (error, account) => {
    if (error && error !== Errors.USER_NOT_FOUND) {
      console.error(error);
      return res.render("error", {
        error: {
          status: 500,
        },
        message: "Interner Fehler",
        stack: undefined,
      });
    }
    return res.render("data-protection", { user: account });
  });
});

router.get("/register/:token", async function (req, res, next) {
  let token = req.params.token;
  db.transact("SELECT username, email FROM account_requests WHERE token = $1", [
    token,
  ]).then((result) => {
    if (result.rows.length > 0) {
      let username = result.rows[0].username;
      let email = result.rows[0].email;
      res.render("register", {
        username: username,
        email: email,
        token: token,
      });
    } else {
      res.render("error", {
        message: "Registrierungstoken wurde nicht gefunden.",
        error: {
          status: 404,
          stack: "Kein solches Token in der Datenbank.",
        },
      });
    }
  });
});

module.exports = router;
