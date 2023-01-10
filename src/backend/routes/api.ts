import express from "express"
const router = express.Router()
var createError = require("http-errors")

import fileUpload from "express-fileupload"
import validator from "email-validator"
import escapeHTML from "escape-html"

import argon2 from "argon2"
import database from "../database"
import amberscript from "../amberscript"

import fs from "fs"
import path from "path"
import { createHash } from "crypto"

import yauzl from "yauzl"

import { default as getVideoDurationInSeconds } from "get-video-duration"
import { Account } from "../account"
import { AccountRequest } from "../request"
import { Converter } from "../converter"
import { recoveryMail } from "../mailer"

import { getAllFiles } from "../../util"

import config from "../../../config.json"

import feedback from "./feedback"

declare interface FileHashEntry {
  filename : string;
  checksum : string;
}

export async function getChecksumFile(directory : string) : Promise<any> {
  const checksumfile = directory + ".checksum";
  if(!fs.existsSync(checksumfile)) {
    await createChecksumFile(directory, checksumfile);
  }
  const string = fs.readFileSync(checksumfile, {encoding: "utf-8"});
  return JSON.parse(string);
}

async function createChecksumFile(directory : string, checksumFile : string) : Promise<void> {
  const files : string[] = getAllFiles(directory, undefined);
  const hashes : FileHashEntry[] = [];
  for(const file of files) {
    const content = await fs.promises.readFile(file);
    const hash = createHash("sha256").update(content).digest("hex");
    const filepath = path.relative(directory, file);
    const item : FileHashEntry = {filename: filepath, checksum: hash};
    hashes.push(item);
  }
  let filecontents = JSON.stringify(hashes);
  await fs.promises.writeFile(checksumFile, filecontents);
}

function makeRandomString(length : number, characters? : string) : string {
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

interface UsernameVerification {
  length: boolean;
  format: boolean;
}

function verifyUsername(username : string) : UsernameVerification {
  let length = username.length;
  let onlyletter = username.match(/[a-z]([a-z]|[0-9])+/gi);
  return { length: length >= 4, format: onlyletter ? onlyletter.length > 0 : false };
}

function verifyEmail(mail : string, allowedOrigins : string[]) {
  let format = validator.validate(mail);
  let origin = true;
  if (allowedOrigins) {
    origin = false;
    for (let suffix of allowedOrigins) {
      if (mail.endsWith(suffix)) {
        origin = true;
        break;
      }
    }
  }
  return { format: format, origin: origin };
}

router.use("/feedback", feedback);

router.post("/login", function (req : express.Request, res : express.Response, next : express.NextFunction) {
  if (req.account) {
    req.session.userId = req.account.id;
    return res
      .status(200)
      .json({
        message: escapeHTML("Login erfolgreich."),
      })
      .end();
  } else {
    return res
      .status(400)
      .json({
        message: escapeHTML("Ungültige Benutzerdaten."),
      })
      .end();
  }
});

router.post("/logout", function (req : express.Request, res : express.Response, next : express.NextFunction) {
  delete req.session.userId;
  res.status(200).json({ message: "Logout erfolgt." }).end();
});

router.post("/request", async function (req : express.Request, res : express.Response, next : express.NextFunction) {
  const username = req.body.requestUser;
  const mail = req.body.requestMail;
  const note = req.body.requestNote;
  if (!username || !mail || !note) {
    return res
      .status(400)
      .json({
        message: escapeHTML("Fehlerhafte Anfrage. Bitte alle Daten spezifizieren."),
      })
      .end();
  }
  let verification = verifyUsername(username);
  if (!verification.length) {
    res
      .status(400)
      .json({
        message: escapeHTML(
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
        message: escapeHTML(
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
        message: escapeHTML("Ungültig formatierte E-Mail Adresse."),
      })
      .end();
  }
  if (!mailverification.origin) {
    return res
      .status(400)
      .json({
        status: "error",
        message: escapeHTML("Anmeldung nur mit einer tu-dortmund.de Adresse."),
      })
      .end();
  }
  try {
    const available : boolean = await AccountRequest.isAvailable(username);
    if(available) {
      const randomToken : string = makeRandomString(64);
      const request = await AccountRequest.reserve(username, mail, randomToken, note);
      if(request) {
        return res.status(200).json({message: escapeHTML("Die Anfrage wurde übermittelt. Wir melden uns bei Ihnen zeitnah per E-Mail.")});
      } else {
        return res.status(500).json({message: escapeHTML("Die Anfrage konnte nicht angelegt werden.")});
      }
    } else {
      return res.status(400).json({message: escapeHTML("Dieser Benutzername ist nicht verfügbar.")});
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({message: "Interner Serverfehler."}).end();
  }
});

router.post("/register", async function (req, res, next) {
  const username = req.body.registerUsername;
  const password = req.body.registerPassword;
  const email = req.body.registerEmail;
  const token = req.body.registerToken;

  if (password.length < 8) {
    return res.status(400).json({
      message: "Passwort muss mindestens 8 Zeichen lang sein.",
    });
  }

  try {
    const request = await AccountRequest.fromDatabase(token);
    if(request) {
      if(request.username !== username || request.email !== email) {
        console.error(username, email);
        res.status(400).json({message: escapeHTML("Registrationsdaten stimmen nicht mit hinterlegten Daten überein.")}).end();
      }
      const account = request.confirm(password);
      if(account) {
        request.removeFromDatabase();
        return res.status(200).json({message: escapeHTML("Account erfolgreich registriert")}).end();
      }
    } else {
      return res.status(404).json({message: escapeHTML("Registrationstoken nicht gefunden")}).end();
    }
  } catch (error) {
    return res.status(500).json({message: escapeHTML("Interner Fehler.")}).end();
  }
});

function required(value : any, res : express.Response) {
  if (!value || value === "") {
    res
      .status(400)
      .json({ message: escapeHTML("Fehlerhafte Anfrage.") })
      .end();
    return true;
  }
  return false;
}

router.post("/user/reset-password", async (req : express.Request, res : express.Response, next : express.NextFunction) => {
  const email = req.body.email;
  const password = req.body.newPassword;
  const token = req.body.token;
  if (required(email, res) || required(password, res) || required(token, res)) {
    return;
  }
  if (password.length < 8) {
    return res
      .status(400)
      .json({
        message: escapeHTML("Das Passwort muss aus mindestens 8 Zeichen bestehen."),
      })
      .end();
  }
  try {
    const userResult = await database.query(
      "SELECT * FROM accounts WHERE email = $1",
      [email]
    );
    const tokenResult = await database.query(
      "SELECT * FROM recovery_requests WHERE token = $1",
      [token]
    );
    if (userResult.rows.length > 0 && tokenResult.rows.length > 0) {
      const user = userResult.rows[0];
      const request = tokenResult.rows[0];
      if (user.id === request.user_id) {
        const account = await Account.fromDatabase(userResult.rows[0].id);
        if (account) {
          account.changePassword(password);
          database.query("DELETE FROM recovery_requests WHERE token = $1", [
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

router.put("/user/:username/password", async (req : express.Request, res : express.Response, next : express.NextFunction) => {
  if (!req.account) {
    return res
      .status(403)
      .json({ message: escapeHTML("Nicht eingeloggt.") })
      .end();
  }
  const account = req.account;
  const username = req.params.username;
  if (account.username !== username) {
    return res
      .status(403)
      .json({ message: escapeHTML("Keine Berechtigung.") })
      .end();
  }
  const oldPassword : string = req.body.oldPassword;
  const newPassword : string = req.body.newPassword;
  if (newPassword.length < 8) {
    return res
      .status(400)
      .json({
        message: escapeHTML("Das Passwort muss aus mindestens 8 Zeichen bestehen."),
      })
      .end();
  }
  try {
    const authenticated = await account.checkPassword(oldPassword);
    if(authenticated) {
      account.changePassword(newPassword);
    } else {
      return res.status(403).json({message: escapeHTML("Keine Berechtigung.")});
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({message: escapeHTML("Interner Fehler.")});
  }
});

router.put("/user/:username/email", async (req : express.Request, res : express.Response, next : express.NextFunction) => {
  const account : Account = req.account;
  if (!account) {
    return res
      .status(403)
      .json({ message: escapeHTML("Nicht eingeloggt.") })
      .end();
  }
  const username = req.params.username;
  if (account.username !== username) {
    return res
      .status(403)
      .json({ message: escapeHTML("Keine Berechtigung.") })
      .end();
  }
  const passwordConfirmation = req.body.passwordConfirmation;
  const newEmail = req.body.newEmail;
  if (!passwordConfirmation || !newEmail) {
    return res
      .status(400)
      .json({ message: escapeHTML("Fehlerhafte Anfrage.") })
      .end();
  }
  const mailverification = verifyEmail(newEmail, ["tu-dortmund.de", "udo.edu"]);
  if (!mailverification.origin) {
    return res
      .status(400)
      .json({ message: escapeHTML("Adresse muss eine Unimailadresse sein.") })
      .end();
  }
  if (!mailverification.format) {
    return res
      .status(400)
      .json({ message: escapeHTML("Keine gültige E-Mail-Adresse.") })
      .end();
  }
  const confirmed = await account.checkPassword(passwordConfirmation);
  if(confirmed) {
    account.changeEmail(newEmail);
  } else {
    return res
      .status(403)
      .json({ message: escapeHTML("Falsches Passwort.") })
      .end();
  }
});

router.put("/user/:username/sshkey", async (req : express.Request, res : express.Response, next : express.NextFunction) => {
  const account = req.account;
  if (!account) {
    return res
      .status(403)
      .json({ message: escapeHTML("Nicht eingeloggt.") })
      .end();
  }
  const username = req.params.username;
  if (account.username !== username) {
    return res
      .status(403)
      .json({ message: escapeHTML("Keine Berechtigung.") })
      .end();
  }
  const passwordConfirmation = req.body.passwordConfirmation;
  const newKey = req.body.newKey;
  if (!passwordConfirmation || !newKey) {
    return res
      .status(400)
      .json({ message: escapeHTML("Fehlerhafte Anfrage.") })
      .end();
  }
  const confirmed = await account.checkPassword(passwordConfirmation);
  if(confirmed) {
    account.setKeys([newKey]);
    return res.status(200).end();
  } else {
    return res.status(403).json({message: escapeHTML("Passwortbestätigung fehlgeschlagen.")});
  }
});

router.delete("/user/:username", async (req : express.Request, res : express.Response, next : express.NextFunction) => {
  const account = req.account;
  const passwordConfirmation = req.body.passwordConfirmation;
  if (!account) {
    return res
      .status(403)
      .json({ message: escapeHTML("Nicht eingeloggt.") })
      .end();
  }
  const confirmed = await account.checkPassword(passwordConfirmation);
  if(account.roles.includes("admin") || confirmed) {
    //TODO Delete Account
  } else {
    return res.status(403).json({message: escapeHTML("Keine Berechtigung.")}).end();
  }
});

router.post("/request-recovery", async (req : express.Request, res : express.Response, next : express.NextFunction) => {
  const email = req.body.recoveryEmail;
  const token = makeRandomString(32);
  if (!email || email === "") {
    return res.status(400).json({ message: "Fehlerhafte Anfrage." }).end();
  }
  const result = await database.query("SELECT * FROM accounts WHERE email = $1", [email]);
  if(result && result.rows.length > 0) {
    const user = result.rows[0];
    const recreq = await database.query("INSERT INTO recovery_requests (user_id, token, created) VALUES($1, $2, NOW()) ON CONFLICT (user_id) DO UPDATE SET token=EXCLUDED.token, created=NOW()", [user.id, token]);
    if(recreq) {
      recoveryMail(email, token);
      return res.status(200).json({message: "Anfrage gesendet." }).end();
    }
  } else {
    return res.status(200).json({message: "Anfrage gesendet." }).end();
  }
});

router.get("/user/:username/project/:projectname", async (req : express.Request, res : express.Response, next : express.NextFunction) => {
  const account : Account = req.account;
  const username = req.params.username;
  const projectname = req.params.projectname;
  if(account.username !== username) {
    return res.status(401).end();
  }
  const userdir = account.getDirectory();
  const projectDirectory = path.join(userdir, "projects", projectname);
  if(!fs.existsSync(projectDirectory)) {
    return res.status(404).end();
  }
  const projectChecksumFile = projectDirectory + ".checksum";
  if(!fs.existsSync(projectChecksumFile)) {
    await createChecksumFile(projectDirectory, projectChecksumFile);
  }
  const content = await fs.promises.readFile(projectChecksumFile);
  return res.status(200).json(content).end();
});

/* POST upload */
router.post("/project", fileUpload(), async (req : express.Request, res : express.Response, next : express.NextFunction) => {
  const account : Account = req.account;
  const projectName : string = req.body.projectName;
  if (!req.files || Object.keys(req.files).length === 0) {
    return res
      .status(400)
      .json({ message: escapeHTML("Keine Datei empfangen.") })
      .end();
  }
  if(Array.isArray(req.files.file)) {
    console.error("[PROJECT UPLOAD] Received multiple files.");
    return res.status(400).json( {message: escapeHTML("Mehrere Dateien empfangen. Bitte nur eine Datei senden.")}).end();
  }

  const file : fileUpload.UploadedFile = req.files.file;

  if (!projectName || projectName === "") {
    return res
      .status(400)
      .json({ status: "error", message: "Kein Projektname empfangen." })
      .end();
  }

  if (projectName.includes(".")) {
    return res
      .status(400)
      .json({ status: "error", message: "Ungültiger Projektname." })
      .end();
  }
  const uploadPath = path.resolve(path.join(account.getDirectory(), "uploads", file.name));
  const projectPath : string = path.join(
    account.getDirectory(),
    "projects",
    projectName
  );

  if (!fs.existsSync(path.join(account.getDirectory(), "projects"))) {
    fs.mkdirSync(path.join(account.getDirectory(), "projects"), {
      recursive: true,
    });
  }

  if (fs.existsSync(projectPath)) {
    return res
      .status(400)
      .json({
        status: "error",
        message: "Projektname wird bereits verwendet.",
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
      let prefix = path.join(account.getDirectory(), "projects");
      function mkdirp(dir : string, cb : () => void) {
        if (dir.startsWith("public")) {
          dir = dir.replace(/public/, projectName);
        }
        if (dir === ".") return cb();
        fs.stat(path.join(prefix, dir), function (err) {
          if (err == null) return cb();
          var parent = path.dirname(dir);
          mkdirp(parent, function () {
            console.log("[YAUZL] Creating Directory:", path.join(prefix, dir));
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

router.get("/video", (req : express.Request, res : express.Response, next : express.NextFunction) => {
  const project : string = req.query.project.toString();
  const filepath : string = req.query.file.toString();
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
  const userdir = req.account.getDirectory();
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

router.delete("/project", async (req : express.Request, res : express.Response, next : express.NextFunction) => {
  const account = req.account;
  const projectname = req.body.name;
  const password = req.body.password;
  if (!projectname || /\.\.(\/|\\)/g.test(projectname)) {
    return res.status(400).json({ message: "Fehlerhafte Anfrage." }).end();
  }
  if(!account) {
    res.status(403).json({message: "Keine Berechtigung."}).end();
  }
  const verified = await account.checkPassword(password);
  if (!verified) {
    return res
      .status(403)
      .json({ message: escapeHTML("Falsches Passwort.") });
  } else {
    const userdir = account.getDirectory();
    const fullpath = path.join(userdir, "projects", projectname);
    if (fs.existsSync(fullpath)) {
      try {
        fs.rmSync(fullpath, { recursive: true, force: true });
        return res
          .status(200)
          .json({ status: "success", message: "Projekt gelöscht." })
          .end();
      } catch (error) {
        console.error(error);
        return res.status(500).json({
          status: "error",
          message: escapeHTML(
            "Interner Fehler: Mit rsync hochgeladene Projekte können nicht über das Webinterface gelöscht werden."
          ),
        });
      }
    } else {
      return res
        .status(400)
        .json({ status: "error", message: "Interner Fehler." })
        .end();
    }
  }
});

router.get("/convert", (req : express.Request, res : express.Response, next : express.NextFunction) => {
  const filequery : string = req.query.file.toString();
  if (!filequery) {
    return res.status(400).end();
  }
  const account = req.account;
  if(!account) {
    return res.status(403).end();
  }
  const userdir = account.getDirectory();
  const filepath = path.join(userdir, "uploads", "pdf", filequery);
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

router.post("/convert", fileUpload(), (req : express.Request, res : express.Response, next : express.NextFunction) => {
  const account = req.account;
  if (!account) {
    res
      .status(400)
      .json({
        message: "Sie haben keine Berechtigung dies zu tun.",
      })
      .end();
  }
  if (!req.files || Object.keys(req.files).length === 0) {
    return res
      .status(400)
      .json({ status: "error", message: "Keine Datei empfangen." })
      .end();
  }
  if(Array.isArray(req.files.file)) {
    console.error("[CONVERT UPLOAD] Received multiple files.");
    return res.status(400).json( {message: escapeHTML("Mehrere Dateien empfangen. Bitte nur eine Datei senden.")}).end();
  }

  const file : fileUpload.UploadedFile = req.files.file;
  let uploadPath = path.join(
    account.getDirectory(),
    "uploads",
    "pdf",
    file.name
  );

  if (!fs.existsSync(path.dirname(uploadPath))) {
    fs.mkdirSync(path.dirname(uploadPath), { recursive: true });
  }

  file.mv(uploadPath, function (err) {
    if (err) {
      console.error(err);
      return res
        .status(500)
        .json({
          message: "Interner Fehler beim Speichern der Datei.",
        })
        .end();
    }
    res
      .status(200)
      .json({
        message: "Datei erfolgreich hochgeladen.",
      })
      .end();
    Converter(uploadPath);
    return;
  });
});

router.post("/amberscript", (req : express.Request, res : express.Response, next : express.NextFunction) => {
  if (!req.account) {
    return res.status(403).end();
  }
  const project = req.body.project || req.query.project;
  const filepath = req.body.filepath || req.query.filepath;
  const userdir = req.account.getDirectory();
  const fullpath = path.join(userdir, "projects", project, filepath);

  if (!fs.existsSync(fullpath)) {
    return res.status(404).json({ message: "Datei nicht gefunden." }).end();
  }
  amberscript.post(req.account, project, filepath, undefined).catch((error : Error) => {
    console.error(error);
    return res.status(500).end();
  });
});

router.post("/amberscript/callback", (req : express.Request, res : express.Response, next : express.NextFunction) => {
  const message = req.body;
  if (!message.jobStatus) {
    return res.status(400).end();
  }
  if (message.jobStatus && message.jobStatus.jobId) {
    const jobId = message.jobStatus.jobId;
    const status = message.jobStatus.status;
    if (status === "DONE") {
      amberscript.finallizeJob(jobId, status);
    } else if (status === "ERROR") {
      amberscript.publishError(jobId, message.jobStatus.errorMsg);
    } else {
      return res.status(400).end();
    }
  }
});

export default router;
