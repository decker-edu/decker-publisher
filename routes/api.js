var express = require("express");
var router = express.Router();
var createError = require("http-errors");

const fileUpload = require("express-fileupload");
const validator = require("email-validator");
const escape = require("escape-html");

const argon2 = require("argon2");

const db = require("../db");
const amberscript = require("../amberscript");

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const yauzl = require("yauzl");

const cache = require("../cache");
const Errors = require("../types/errors");
const { default: getVideoDurationInSeconds } = require("get-video-duration");
const Account = require("../types/account");
const converter = require("../converter");
const mailer = require("../mailer");
const { config } = require("process");

function makeRandomString(length, characters) {
  let result = "";
  let options = characters
    ? characters
    : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let amount = options.length;
  for (let i = 0; i < length; i++) {
    result += options.charAt(Math.floor(Math.random() * amount));
  }
  return result;
}

function verifyUsername(string) {
  let length = string.length;
  let onlyletter = string.match(/[a-z]([a-z]|[0-9])+/gi);
  return { length: length >= 4, format: onlyletter };
}

function verifyEmail(string, allowedOrigins) {
  let format = validator.validate(string);
  let origin = true;
  if (allowedOrigins) {
    origin = false;
    for (let suffix of allowedOrigins) {
      if (string.endsWith(suffix)) {
        origin = true;
        break;
      }
    }
  }
  return { format: format, origin: origin };
}

router.post("/login", function (req, res, next) {
  if (req.account) {
    req.session.user = req.account.id;
    return res
      .status(200)
      .json({
        status: "success",
        message: escape("Login erfolgreich."),
      })
      .end();
  } else {
    return res
      .status(400)
      .json({
        status: "error",
        message: escape("Ungültige Benutzerdaten."),
      })
      .end();
  }
});

router.post("/logout", function (req, res, next) {
  delete req.session.user;
  res.status(200).json({ status: "success", message: "Logout erfolgt." }).end();
});

router.post("/request", function (req, res, next) {
  let user = req.body.requestUser;
  let mail = req.body.requestMail;
  let note = req.body.requestNote;
  console.log(user, mail, note);
  if (!user || !mail || !note) {
    return res
      .status(400)
      .json({
        status: "error",
        message: escape("Fehlerhafte Anfrage. Bitte alle Daten spezifizieren."),
      })
      .end();
  }
  let verification = verifyUsername(user);
  if (!verification.length) {
    res
      .status(400)
      .json({
        status: "error",
        message: escape(
          "Der Benutzername sollte mindestens 4 Zeichen beinhalten."
        ),
      })
      .end();
    return;
  }
  if (!verification.format) {
    res
      .status(400)
      .json({
        status: "error",
        message: escape(
          "Der Benutzername muss mit einem Buchstaben beginnen und darf nur Buchstaben oder Zahlen beinhalten."
        ),
      })
      .end();
    return;
  }
  let mailverification = verifyEmail(mail, ["tu-dortmund.de", "udo.edu"]);
  if (!mailverification.format) {
    return res
      .status(400)
      .json({
        status: "error",
        message: escape("Ungültig formatierte E-Mail Adresse."),
      })
      .end();
  }
  if (!mailverification.origin) {
    return res
      .status(400)
      .json({
        status: "error",
        message: escape("Anmeldung nur mit einer tu-dortmund.de Adresse."),
      })
      .end();
  }
  db.transact("SELECT * FROM accounts where username = $1", [user]).then(
    (result) => {
      if (result.rows.length > 0) {
        return res.status(400).json({
          status: "error",
          message: escape("Dieser Benutzername ist bereits reserviert."),
        });
      } else {
        db.transact("SELECT * FROM account_requests WHERE username = $1", [
          user,
        ]).then((result) => {
          if (result.rows.length > 0) {
            return res.status(400).json({
              status: "error",
              message: escape("Dieser Benutzername ist bereits reserviert."),
            });
          } else {
            let randomToken = makeRandomString(64);
            db.transact(
              "INSERT INTO account_requests (token, username, email, created, note) VALUES ($1, $2, $3, NOW(), $4)",
              [randomToken, user, mail, note]
            )
              .then((result) => {
                console.log(
                  "[requests]",
                  `${result.command} executed. ${result.rowCount} rows affected.`
                );
                return res
                  .status(200)
                  .json({
                    status: "success",
                    message: escape(
                      "Anfrage wurde übermittelt, der Administrator wird Ihnen bald eine E-Mail senden."
                    ),
                  })
                  .end();
              })
              .catch((error) => {
                console.error("[ACCOUNT REQUEST] [DB ERROR]", error);
                res.status(500).json({
                  status: "error",
                  message: "Interner Datenbankfehler",
                });
              });
          }
        });
      }
    }
  );
});

router.post("/register", function (req, res, next) {
  let username = req.body.registerUsername;
  let password = req.body.registerPassword;
  let email = req.body.registerEmail;
  let token = req.body.registerToken;

  if (password.length < 8) {
    return res.status(400).json({
      status: "error",
      message: "Passwort muss mindestens 8 Zeichen lang sein.",
    });
  }

  db.transact("SELECT username, email FROM account_requests WHERE token = $1", [
    token,
  ])
    .then((result) => {
      if (result.rows.length > 0) {
        let entry = result.rows[0];
        if (entry.username !== username || entry.email !== email) {
          console.error(username, email);
          console.error(entry.username, entry.email);
          res
            .status(400)
            .json({
              status: "error",
              message: escape(
                "Registrationsdaten stimmen nicht mit hinterlegten Daten überein."
              ),
            })
            .end();
          return false;
        }
        return true;
      } else {
        res
          .status(400)
          .json({
            status: "error",
            message: escape("Registrationstoken nicht gefunden."),
          })
          .end();
        return false;
      }
    })
    .then((success) => {
      if (success) {
        try {
          cache
            .createAccount(username, password, email)
            .then((success) => {
              db.transact("DELETE FROM account_requests WHERE username=$1", [
                username,
              ]).catch((error) => {
                console.error(error);
              });
              if (success) {
                return res.status(200).json({
                  status: "success",
                  message: "Account erfolgreich registriert.",
                });
              } else {
                console.error(
                  "Fehler: Registrierung resolved aber success nicht true."
                );
                return res
                  .status(500)
                  .json({
                    status: "error",
                    message: "Interner Fehler.",
                  })
                  .end();
              }
            })
            .catch((error) => {
              console.error(error);
              res
                .status(500)
                .json({
                  status: "error",
                  message: "Interner Fehler.",
                })
                .end();
            });
        } catch (error) {
          console.error(error);
        }
      }
    });
});

function required(value, res) {
  if (!value || value === "") {
    res
      .status(400)
      .json({ message: escape("Fehlerhafte Anfrage.") })
      .end();
    return true;
  }
  return false;
}

router.post("/user/reset-password", async (req, res, next) => {
  const email = req.body.email;
  const password = req.body.newPassword;
  const token = req.body.token;
  if (required(email) || required(password) || required(token)) {
    return;
  }
  if (password.length < 8) {
    return res
      .status(400)
      .json({
        message: escape("Das Passwort muss aus mindestens 8 Zeichen bestehen."),
      })
      .end();
  }
  try {
    const userResult = await db.transact(
      "SELECT * FROM accounts WHERE email = $1",
      [email]
    );
    const tokenResult = await db.transact(
      "SELECT * FROM recovery_requests WHERE token = $1",
      [token]
    );
    if (userResult.rows.length > 0 && tokenResult.rows.length > 0) {
      const user = userResult.rows[0];
      const request = tokenResult.rows[0];
      if (user.id === request.user_id) {
        const account = await db.getAccountByID(userResult.rows[0].id);
        if (account) {
          account.updatePassword(password);
          db.transact("DELETE FROM recovery_requests WHERE token = $1", [
            token,
          ]);
          return res.status(200).json({ message: "Passwort geändert." }).end();
        }
      } else {
        return res.status(400).json({ message: "Fehlerhafte Anfrage." }).end();
      }
    } else {
      return res.status(400).json({ message: "Fehlerhafte Anfrage." }).end();
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Interner Fehler." }).end();
  }
});

router.put("/user/:username/password", (req, res, next) => {
  if (!req.account) {
    return res
      .status(403)
      .json({ message: escape("Nicht eingeloggt.") })
      .end();
  }
  const username = req.params.username;
  if (req.account.username !== username) {
    return res
      .status(403)
      .json({ message: escape("Keine Berechtigung.") })
      .end();
  }
  const oldPassword = req.body.oldPassword;
  const newPassword = req.body.newPassword;
  if (newPassword.length < 8) {
    return res
      .status(400)
      .json({
        message: escape("Das Passwort muss aus mindestens 8 Zeichen bestehen."),
      })
      .end();
  }
  req.account.checkPassword(oldPassword).then((success) => {
    if (success) {
      req.account
        .updatePassword(newPassword)
        .then((success) => {
          if (success) {
            cache.exportFeedbackUsers();
            return res
              .status(200)
              .json({ message: "Passwort geändert." })
              .end();
          }
          return res
            .status(500)
            .json({
              message: "Interner Fehler beim aktuallisieren des Passworts.",
            })
            .end();
        })
        .catch((error) => {
          console.error(error);
          return res
            .status(500)
            .json({
              message: "Interner Fehler beim aktuallisieren des Passworts.",
            })
            .end();
        });
    } else {
      return res.status(403).json({ message: "Falsches Passwort." }).end();
    }
  });
});

router.put("/user/:username/email", (req, res, next) => {
  if (!req.account) {
    return res
      .status(403)
      .json({ message: escape("Nicht eingeloggt.") })
      .end();
  }
  const username = req.params.username;
  if (req.account.username !== username) {
    return res
      .status(403)
      .json({ message: escape("Keine Berechtigung.") })
      .end();
  }
  const passwordConfirmation = req.body.passwordConfirmation;
  const newEmail = req.body.newEmail;
  if (!passwordConfirmation || !newEmail) {
    return res
      .status(400)
      .json({ message: escape("Fehlerhafte Anfrage.") })
      .end();
  }
  const mailverification = verifyEmail(newEmail, ["tu-dortmund.de", "udo.edu"]);
  if (!mailverification.origin) {
    return res
      .status(400)
      .json({ message: escape("Adresse muss eine Unimailadresse sein.") })
      .end();
  }
  if (!mailverification.format) {
    return res
      .status(400)
      .json({ message: escape("Keine gültige E-Mail-Adresse.") })
      .end();
  }
  req.account.checkPassword(passwordConfirmation).then((success) => {
    if (success) {
      req.account
        .updateEmail(newEmail)
        .then((success) => {
          if (success) {
            cache.exportFeedbackUsers();
            return res
              .status(200)
              .json({ message: escape("E-Mail geändert.") })
              .end();
          }
          return res
            .status(500)
            .json({
              message: escape(
                "Interner Fehler beim aktuallisieren der E-Mail-Adresse."
              ),
            })
            .end();
        })
        .catch((error) => {
          console.error(error);
          return res
            .status(500)
            .json({
              message: escape(
                "Interner Fehler beim aktuallisieren der E-Mail-Adresse."
              ),
            })
            .end();
        });
    } else {
      return res
        .status(403)
        .json({ message: escape("Falsches Passwort.") })
        .end();
    }
  });
});

router.put("/user/:username/sshkey", (req, res, next) => {
  if (!req.account) {
    return res
      .status(403)
      .json({ message: escape("Nicht eingeloggt.") })
      .end();
  }
  const username = req.params.username;
  if (req.account.username !== username) {
    return res
      .status(403)
      .json({ message: escape("Keine Berechtigung.") })
      .end();
  }
  const passwordConfirmation = req.body.passwordConfirmation;
  const newKey = req.body.newKey;
  if (!passwordConfirmation || !newKey) {
    return res
      .status(400)
      .json({ message: escape("Fehlerhafte Anfrage.") })
      .end();
  }
  req.account.checkPassword(passwordConfirmation).then((success) => {
    if (success) {
      req.account.setSSHKey(newKey);
      return res
        .status(200)
        .json({ message: escape("Schlüssel übernommen.") })
        .end();
    } else {
      return res
        .status(403)
        .json({ message: escape("Passwortbestätigung fehlgeschlagen.") })
        .end();
    }
  });
});

router.delete("/user/:username", (req, res, next) => {
  const passwordConfirmation = req.body.passwordConfirmation;
  if (!req.account) {
    return res
      .status(403)
      .json({ message: escape("Nicht eingeloggt.") })
      .end();
  }
  req.account.hasRole("admin", (error, role) => {
    if (role) {
      db.deleteAccount(req.params.username);
    } else {
      if (!passwordConfirmation) {
        return res
          .status(400)
          .json({ message: escape("Fehlerhafte Anfrage") })
          .end();
      }
      req.account.checkPassword(passwordConfirmation).then((success) => {
        if (success) {
          db.deleteAccount(req.params.username);
        } else {
          return res
            .status(403)
            .json({ message: escape("Keine Berechtigung") })
            .end();
        }
      });
    }
  });
});

router.post("/request-recovery", async (req, res, next) => {
  const email = req.body.recoveryEmail;
  const token = makeRandomString(32);
  if (!email || email === "") {
    return res.status(400).json({ message: "Fehlerhafte Anfrage." }).end();
  }
  db.transact("SELECT * FROM accounts WHERE email = $1", [email])
    .then((result) => {
      if (result && result.rows && result.rows.length > 0) {
        const user = result.rows[0];
        db.transact(
          "INSERT INTO recovery_requests (user_id, token, created) VALUES($1, $2, NOW()) ON CONFLICT (user_id) DO UPDATE SET token=EXCLUDED.token, created=NOW()",
          [user.id, token]
        ).then((result) => {
          if (result) {
            mailer.sendRecoveryMail(email, token);
            return res.status(200).json({ message: "Anfrage gesendet." }).end();
          }
        });
      } else {
        return res.status(200).json({ message: "Anfrage gesendet." }).end();
      }
    })
    .catch((error) => {
      console.error(error);
      return res.status(500).json({ message: "Interner Fehler." }).end();
    });
});

/* POST upload */
router.post("/project", fileUpload(), async (req, res, next) => {
  cache.authenticate(req, (error, account) => {
    if (error) {
      res
        .status(400)
        .json({
          status: "error",
          message: escape("Sie haben keine Berechtigung dies zu tun."),
        })
        .end();
    }
    let file;
    let uploadPath;
    let projectName;
    if (!req.files || Object.keys(req.files).length === 0) {
      return res
        .status(400)
        .json({ status: "error", message: escape("Keine Datei empfangen.") })
        .end();
    }

    if (!req.body.projectName || req.body.projectName === "") {
      return res
        .status(400)
        .json({ status: "error", message: "Kein Projektname empfangen." })
        .end();
    }

    if (req.body.projectName.includes(".")) {
      return res
        .status(400)
        .json({ status: "error", message: "Ungültiger Projektname." })
        .end();
    }

    file = req.files.file;
    projectName = req.body.projectName;

    uploadPath = path.join(account.getUserDirectory(), "uploads", file.name);
    uploadPath = path.resolve(uploadPath);

    projectPath = path.join(
      account.getUserDirectory(),
      "projects",
      projectName
    );

    if (!fs.existsSync(path.join(account.getUserDirectory(), "projects"))) {
      fs.mkdirSync(path.join(account.getUserDirectory(), "projects"), {
        recursive: true,
      });
    }

    if (fs.existsSync(projectPath)) {
      return res
        .status(400)
        .json({
          status: "error",
          message: "Projektname wird bereits genutzt.",
        })
        .end();
    }

    if (!fs.existsSync(path.dirname(uploadPath))) {
      fs.mkdirSync(path.dirname(uploadPath), { recursive: true });
    }

    file.mv(uploadPath, function (err) {
      if (err) {
        console.error(err);
        return res
          .status(500)
          .json({
            status: "error",
            message: "Interner Fehler beim speichern der Datei.",
          })
          .end();
      }
      yauzl.open(uploadPath, { lazyEntries: true }, function (err, zipfile) {
        let prefix = path.join(account.getUserDirectory(), "projects");
        function mkdirp(dir, cb) {
          if (dir.startsWith("public")) {
            dir = dir.replace(/public/, projectName);
          }
          if (dir === ".") return cb();
          fs.stat(path.join(prefix, dir), function (err) {
            if (err == null) return cb();
            var parent = path.dirname(dir);
            mkdirp(parent, function () {
              console.log("[YAUZL] Creating Directory:", dir);
              fs.mkdir(path.join(prefix, dir), cb);
            });
          });
        }
        if (err) {
          console.error(err);
          return;
        }
        zipfile.readEntry();
        zipfile.on("entry", function (entry) {
          if (/\/$/.test(entry.fileName)) {
            mkdirp(entry.fileName, function () {
              if (err) {
                console.error(err);
                return;
              }
              zipfile.readEntry();
            });
          } else {
            mkdirp(path.dirname(entry.fileName), function () {
              zipfile.openReadStream(entry, function (err, readStream) {
                if (err) throw err;
                readStream.on("end", function () {
                  zipfile.readEntry();
                });
                let unpackTarget = path.join(prefix, entry.fileName);
                unpackTarget = unpackTarget.replace(/public/, projectName);
                let writeStream = fs.createWriteStream(unpackTarget);
                readStream.pipe(writeStream);
              });
            });
          }
        });
        zipfile.on("end", function () {
          zipfile.close();
        });
        zipfile.on("close", function () {
          fs.rmSync(uploadPath);
        });
      });
      return res
        .status(200)
        .json({
          status: "success",
          message: "Datei erfolgreich hochgeladen.",
        })
        .end();
    });
  });
});

router.get("/video", (req, res, next) => {
  let project = req.query.project;
  let filepath = req.query.file;
  if (!project || project === "" || /\.\.(\/|\\)/g.test(project)) {
    return res
      .status(400)
      .json({ status: "error", message: "Fehlerhafte Anfrage." })
      .end();
  }
  if (!filepath || filepath === "" || /\.\.(\/|\\)/g.test(filepath)) {
    return res
      .status(400)
      .json({ status: "error", message: "Fehlerhafte Anfrage." })
      .end();
  }
  if (!req.account) {
    return res
      .status(403)
      .json({ status: "error", message: "Nicht authentifiziert." })
      .end();
  }
  const userdir = req.account.getUserDirectory();
  const fullpath = path.join(userdir, "projects", project, filepath);
  const filename = path.basename(fullpath, path.extname(fullpath));
  const dirname = path.dirname(fullpath);
  const subtitles = filename + ".vtt";
  const vttfile = path.join(dirname, subtitles);
  let hasvtt = false;
  if (fs.existsSync(vttfile)) {
    hasvtt = true;
  }
  if (fs.existsSync(fullpath)) {
    getVideoDurationInSeconds(fullpath).then((seconds) => {
      return res
        .status(200)
        .json({ status: "success", data: { length: seconds, vtt: hasvtt } })
        .end();
    });
  } else {
    return res
      .status(404)
      .json({ status: "error", message: "Video nicht gefunden." })
      .end();
  }
});

router.delete("/project", (req, res, next) => {
  let projectname = req.body.name;
  let password = req.body.password;
  if (!projectname || /\.\.(\/|\\)/g.test(projectname)) {
    return res
      .status(400)
      .json({ status: "error", message: "Fehlerhafte Anfrage." })
      .end();
  }
  cache.authenticate(req, (error, account) => {
    if (error) {
      console.error(error);
      return res
        .status(403)
        .json({
          status: "error",
          message: "Sie haben keine berechtigung dies zu tun.",
        })
        .end();
    }
    if (account) {
      account.checkPassword(password).then((verified) => {
        if (!verified) {
          return res
            .status(403)
            .json({ status: "error", message: escape("Falsches Passwort.") });
        } else {
          const userdir = account.getUserDirectory();
          const fullpath = path.join(userdir, "projects", projectname);
          if (fs.existsSync(fullpath)) {
            fs.rmSync(fullpath, { recursive: true, force: true });
            return res
              .status(200)
              .json({ status: "success", message: "Projekt gelöscht." })
              .end();
          } else {
            return res
              .status(400)
              .json({ status: "error", message: "Interner Fehler." })
              .end();
          }
        }
      });
    }
  });
});

router.get("/convert", (req, res, next) => {
  const filequery = req.query.file;
  if (!filequery) {
    return res.status(400).end();
  }
  cache.authenticate(req, (error, account) => {
    if (error) {
      return res.status(403).end();
    }
    if (!account) {
      return res.status(403).end();
    }
    let userdir = account.getUserDirectory();
    let filepath = path.join(userdir, "uploads", "pdf", filequery);
    console.log(filepath);
    if (!fs.existsSync(filepath)) {
      return res.status(404).end();
    } else {
      return res.download(filepath, filequery, (err) => {
        if (err) {
          res.end();
        } else {
          console.log("[convert] File download complete. File deleted.");
          fs.rmSync(filepath);
          res.end();
        }
      });
    }
  });
});

router.post("/convert", fileUpload(), (req, res, next) => {
  cache.authenticate(req, (error, account) => {
    if (error || !account) {
      res
        .status(400)
        .json({
          status: "error",
          message: "Sie haben keine Berechtigung dies zu tun.",
        })
        .end();
    }
    let file;
    if (!req.files || Object.keys(req.files).length === 0) {
      return res
        .status(400)
        .json({ status: "error", message: "Keine Datei empfangen." })
        .end();
    }
    file = req.files.file;
    let uploadPath = path.join(
      account.getUserDirectory(),
      "uploads",
      "pdf",
      file.name
    );
    console.log("[UPLOAD] Path:", uploadPath);

    if (!fs.existsSync(path.dirname(uploadPath))) {
      fs.mkdirSync(path.dirname(uploadPath), { recursive: true });
    }

    file.mv(uploadPath, function (err) {
      if (err) {
        console.error(err);
        return res
          .status(500)
          .json({
            status: "error",
            message: "Interner Fehler beim speichern der Datei.",
          })
          .end();
      }
      res
        .status(200)
        .json({
          status: "success",
          message: "Datei erfolgreich hochgeladen.",
        })
        .end();
      converter.convertPDF(uploadPath);
      return;
    });
  });
});

router.post("/amberscript", (req, res, next) => {
  if (!req.account) {
    return res.status(403).end();
  }
  const project = req.body.project || req.query.project;
  const filepath = req.body.filepath || req.query.filepath;
  const userdir = req.account.getUserDirectory();
  const fullpath = path.join(userdir, "projects", project, filepath);
  if (!fs.existsSync(fullpath)) {
    return res.status(404).json({ message: "Datei nicht gefunden." }).end();
  }
  amberscript.post(req.account, project, filepath, undefined).catch((error) => {
    console.error(error);
    return res.status(500).end();
  });
});

router.post("/amberscript/callback", (req, res, next) => {
  const message = req.body;
  if (!message.jobStatus) {
    return res.status(400).end();
  }
  if (message.jobStatus && message.jobStatus.jobId) {
    const jobId = message.jobStatus.jobId;
    const status = message.jobStatus.status;
    if (status === "DONE") {
      amberscript.finallizeJob(jobId);
    } else if (status === "ERROR") {
      amberscript.publishError(jobId, message.jobStatus.errorMsg);
    } else {
      return res.status(400).end();
    }
  }
});

module.exports = router;
