import express from "express";
const router = express.Router();
var createError = require("http-errors");

import fileUpload from "express-fileupload";
import validator from "email-validator";
import escapeHTML from "escape-html";

import argon2 from "argon2";
import database from "../database";
import amberscript from "../amberscript";

import fs from "fs";
import path from "path";
import { createHash } from "crypto";

import yauzl from "yauzl";

import { default as getVideoDurationInSeconds } from "get-video-duration";
import { Account } from "../account";
import { AccountRequest } from "../request";
import { Converter } from "../converter";
import { recoveryMail, requestMail } from "../mailer";

import { getAllFiles } from "../../util";

import userAPI from "./api/user";
import projectAPI from "./api/project";
import amberAPI from "./api/amberscript";
import feedback from "./feedback";
import { EventEmitter } from "stream";

declare interface FileHashEntry {
  kind: "file" | "directory";
  filename: string;
  filepath: string;
  checksum: string;
  modified?: number;
  children?: FileHashEntry[];
}

export function getChecksums(root: string, directory: string): FileHashEntry[] {
  const result: FileHashEntry[] = [];
  const entries = fs.readdirSync(directory);
  for (const entry of entries) {
    if (entry.endsWith(".htpasswd")) {
      continue;
    }
    const filepath = path.join(directory, entry);
    const stat = fs.statSync(filepath);
    if (stat.isDirectory()) {
      const sub = getChecksums(root, filepath);
      const subtree: FileHashEntry = {
        kind: "directory",
        filename: entry,
        filepath: path.relative(root, path.join(directory, entry)),
        checksum: "",
        modified: Math.floor(stat.mtime.getTime()),
        children: sub,
      };
      if (path.sep === "\\") {
        subtree.filepath = subtree.filepath.replace(/\\/g, "/");
      }
      result.push(subtree);
    } else {
      const content = fs.readFileSync(filepath);
      const hash = createHash("sha256").update(content).digest("hex");
      const data: FileHashEntry = {
        kind: "file",
        filename: entry,
        filepath: path.relative(root, path.join(directory, entry)),
        checksum: hash,
        modified: Math.floor(stat.mtime.getTime()),
        children: null,
      };
      if (path.sep === "\\") {
        data.filepath = data.filepath.replace(/\\/g, "/");
      }
      result.push(data);
    }
  }
  return result;
}

function makeRandomString(length: number, characters?: string): string {
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

function verifyUsername(username: string): UsernameVerification {
  let length = username.length;
  let onlyletter = username.match(/^[a-z]([a-z]|[0-9])+$/gi);
  return {
    length: length >= 4,
    format: onlyletter ? onlyletter.length > 0 : false,
  };
}

function verifyEmail(mail: string, allowedOrigins: string[]) {
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
router.use("/user", userAPI);
router.use("/project", projectAPI);
router.use("/amberscript", amberAPI);

router.get(
  "/session",
  async function (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    if (req.account) {
      return res.status(200).json({ username: req.account.username }).end();
    } else {
      return res.status(403).end();
    }
  }
);

router.post(
  "/login",
  function (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
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
  }
);

router.post(
  "/logout",
  function (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    delete req.session.userId;
    res.status(200).json({ message: "Logout erfolgt." }).end();
  }
);

router.post(
  "/request",
  async function (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    const username = req.body.requestUser;
    const mail = req.body.requestMail;
    const note = req.body.requestNote;
    if (!username || !mail || !note) {
      return res
        .status(400)
        .json({
          message: escapeHTML(
            "Fehlerhafte Anfrage. Bitte alle Daten spezifizieren."
          ),
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
          message: escapeHTML(
            "Anmeldung nur mit einer tu-dortmund.de Adresse."
          ),
        })
        .end();
    }
    try {
      const available: boolean = await AccountRequest.isAvailable(username);
      if (available) {
        const randomToken: string = makeRandomString(64);
        const request = await AccountRequest.reserve(
          username,
          mail,
          randomToken,
          note
        );
        if (request) {
          const owner = await database.query(
            "SELECT email FROM accounts WHERE id = 1"
          );
          if (owner && owner.rows.length > 0) {
            const recepient = owner.rows[0];
            requestMail(
              recepient.email,
              escapeHTML(username),
              escapeHTML(mail),
              escapeHTML(note)
            );
          }
          return res.status(200).json({
            message: escapeHTML(
              "Die Anfrage wurde übermittelt. Wir melden uns bei Ihnen zeitnah per E-Mail."
            ),
          });
        } else {
          return res.status(500).json({
            message: escapeHTML("Die Anfrage konnte nicht angelegt werden."),
          });
        }
      } else {
        return res.status(400).json({
          message: escapeHTML("Dieser Benutzername ist nicht verfügbar."),
        });
      }
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Interner Serverfehler." }).end();
    }
  }
);

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
    if (request) {
      if (request.username !== username || request.email !== email) {
        console.error(username, email);
        res
          .status(400)
          .json({
            message: escapeHTML(
              "Registrationsdaten stimmen nicht mit hinterlegten Daten überein."
            ),
          })
          .end();
      }
      const account = request.confirm(password);
      if (account) {
        request.removeFromDatabase();
        return res
          .status(200)
          .json({ message: escapeHTML("Account erfolgreich registriert") })
          .end();
      }
    } else {
      return res
        .status(404)
        .json({ message: escapeHTML("Registrationstoken nicht gefunden") })
        .end();
    }
  } catch (error) {
    return res
      .status(500)
      .json({ message: escapeHTML("Interner Fehler.") })
      .end();
  }
});

function required(value: any, res: express.Response) {
  if (!value || value === "") {
    res
      .status(400)
      .json({ message: escapeHTML("Fehlerhafte Anfrage.") })
      .end();
    return true;
  }
  return false;
}

router.post(
  "/request-recovery",
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const email = req.body.recoveryEmail;
    const token = makeRandomString(32);
    if (!email || email === "") {
      return res.status(400).json({ message: "Fehlerhafte Anfrage." }).end();
    }
    const result = await database.query(
      "SELECT * FROM accounts WHERE email = $1",
      [email]
    );
    if (result && result.rows.length > 0) {
      const user = result.rows[0];
      const recreq = await database.query(
        "INSERT INTO recovery_requests (user_id, token, created) VALUES($1, $2, NOW()) ON CONFLICT (user_id) DO UPDATE SET token=EXCLUDED.token, created=NOW()",
        [user.id, token]
      );
      if (recreq) {
        recoveryMail(email, token);
        return res
          .status(200)
          .json({
            message: escapeHTML(
              "Anfrage empfangen. Bitte überprüfen Sie Ihr Postfach."
            ),
          })
          .end();
      }
    } else {
      return res
        .status(200)
        .json({
          message: escapeHTML(
            "Anfrage empfangen. Bitte überprüfen Sie Ihr Postfach."
          ),
        })
        .end();
    }
  }
);

/* POST upload */
router.post(
  "/project",
  fileUpload(),
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const account: IAccount = req.account;
    if (!account) {
      return res
        .status(403)
        .json({ message: escapeHTML("Nicht eingeloggt.") })
        .end();
    }
    const projectName: string = req.body.projectName;
    if (!req.files || Object.keys(req.files).length === 0) {
      return res
        .status(400)
        .json({ message: escapeHTML("Keine Datei empfangen.") })
        .end();
    }
    if (Array.isArray(req.files.file) || Object.keys(req.files).length > 1) {
      console.error("[PROJECT UPLOAD] Received multiple files.");
      return res
        .status(400)
        .json({
          message: escapeHTML(
            "Mehrere Dateien empfangen. Bitte nur eine Datei senden."
          ),
        })
        .end();
    }

    const file: fileUpload.UploadedFile = req.files.file;

    if (!projectName || projectName === "") {
      return res
        .status(400)
        .json({ status: "error", message: "Keinen Projektnamen empfangen." })
        .end();
    }

    if (projectName.includes(".")) {
      return res
        .status(400)
        .json({ status: "error", message: "Ungültiger Projektname." })
        .end();
    }
    const uploadPath = path.resolve(
      path.join(account.getDirectory(), "uploads", file.name)
    );
    const projectPath: string = path.join(
      account.getDirectory(),
      "projects",
      projectName
    );

    if (!fs.existsSync(path.join(account.getDirectory(), "projects"))) {
      fs.mkdirSync(path.join(account.getDirectory(), "projects"), {
        recursive: true,
        mode: 0o0775,
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
      fs.mkdirSync(path.dirname(uploadPath), { recursive: true, mode: 0o0775 });
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
        console.log("[YAUZL] starting extraction.");
        let prefix = path.join(account.getDirectory(), "projects");
        function mkdirp(dir: string, cb: () => void) {
          if (dir.startsWith("public")) {
            dir = dir.replace(/public/, projectName);
          }
          if (dir === ".") return cb();
          fs.stat(path.join(prefix, dir), function (err) {
            if (err == null) return cb();
            var parent = path.dirname(dir);
            mkdirp(parent, function () {
              console.log(
                "[YAUZL] Creating Directory:",
                path.join(prefix, dir)
              );
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
          console.log("[YAUZL] End of file reached. Closing zipfile.");
          zipfile.close();
        });
        zipfile.on("close", function () {
          console.log("[YAUZL] Closed zipfile. Deleting zipfile.");
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
  }
);

router.post(
  "/project/directory",
  fileUpload(),
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const account: IAccount = req.account;
    if (!account) {
      return res
        .status(403)
        .json({ message: escapeHTML("Nicht eingeloggt.") })
        .end();
    }
    const projectName: string = req.body.projectName;
    if (!req.files || Object.keys(req.files).length === 0) {
      return res
        .status(400)
        .json({ message: escapeHTML("Keine Datei empfangen.") })
        .end();
    }
    const paths: string[] = req.body.paths;
    const files = req.files.directory;
    if (Array.isArray(files)) {
      console.log("[DEBUG]", files.length, "files received.");
    } else {
      return res
        .status(400)
        .json({ status: "error", message: "Keine Dateien empfangen." })
        .end();
    }

    if (!projectName || projectName === "") {
      return res
        .status(400)
        .json({ status: "error", message: "Keinen Projektnamen empfangen." })
        .end();
    }

    if (projectName.includes(".")) {
      return res
        .status(400)
        .json({ status: "error", message: "Ungültiger Projektname." })
        .end();
    }

    if (files.length !== paths.length) {
      console.error("[UPLOAD ERROR]: ", files.length, "vs.", paths.length);
      return res
        .status(400)
        .json({
          status: "error",
          message: "Pfade korrespondieren nicht zu Dateien.",
        })
        .end();
    }

    const projectPath: string = path.join(
      account.getDirectory(),
      "projects",
      projectName
    );

    if (!fs.existsSync(path.join(account.getDirectory(), "projects"))) {
      fs.mkdirSync(path.join(account.getDirectory(), "projects"), {
        recursive: true,
        mode: 0o0775,
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

    fs.mkdirSync(projectPath, {
      recursive: true,
      mode: 0o0775,
    });

    for (let i = 0; i < files.length; i++) {
      const target = path.join(projectPath, paths[i]);
      const directory = path.dirname(target);
      const basename = path.basename(target);
      if (basename !== decodeURI(files[i].name)) {
        console.log("NAME:", basename, decodeURI(files[i].name));
        continue;
      }
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, {
          recursive: true,
          mode: 0o0775,
        });
      }
      files[i].mv(path.join(projectPath, paths[i]), function (err) {
        if (err) {
          console.error(err);
        }
      });
    }

    return res.status(200).end();
  }
);

router.post(
  "/project/empty",
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const account: IAccount = req.account;
    if (!account) {
      return res
        .status(403)
        .json({ message: escapeHTML("Nicht eingeloggt.") })
        .end();
    }
    const projectName: string = req.body.projectName;
    if (!projectName || projectName === "") {
      return res
        .status(400)
        .json({ status: "error", message: "Keinen Projektnamen empfangen." })
        .end();
    }

    if (projectName.includes(".")) {
      return res
        .status(400)
        .json({ status: "error", message: "Ungültiger Projektname." })
        .end();
    }
    const projectPath: string = path.join(
      account.getDirectory(),
      "projects",
      projectName
    );

    if (!fs.existsSync(path.join(account.getDirectory(), "projects"))) {
      fs.mkdirSync(path.join(account.getDirectory(), "projects"), {
        recursive: true,
        mode: 0o0775,
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
    fs.mkdirSync(projectPath, { recursive: true, mode: 0o0775 });
    return res
      .status(200)
      .json({ message: "Projektverzeichnis erfolgreich angelegt." })
      .end();
  }
);

router.post(
  "/video",
  fileUpload(),
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const account: IAccount = req.account;
    if (!account) {
      return res
        .status(403)
        .json({ message: escapeHTML("Nicht eingeloggt.") })
        .end();
    }
    if (!req.files || Object.keys(req.files).length === 0) {
      return res
        .status(400)
        .json({ message: escapeHTML("Keine Datei empfangen.") })
        .end();
    }
    if (Array.isArray(req.files.file)) {
      console.error("[PROJECT UPLOAD] Received multiple files.");
      return res
        .status(400)
        .json({
          message: escapeHTML(
            "Mehrere Dateien empfangen. Bitte nur eine Datei senden."
          ),
        })
        .end();
    }
    const file: fileUpload.UploadedFile = req.files.file;
    const userdir = account.getDirectory();
    const filename = file.name;
    const ext = path.extname(filename);
    const supported =
      ext === ".mp4" ||
      ext === ".wav" ||
      ext === ".mp3" ||
      ext === ".m4a" ||
      ext === ".aac" ||
      ext === ".wma" ||
      ext === ".mov" ||
      ext === ".m4v" ||
      ext === ".ogg" ||
      ext === ".opus" ||
      ext === ".flac";
    if (!supported) {
      return res
        .status(400)
        .json({ message: escapeHTML("Nicht unterstütztes Dateiformat.") })
        .end();
    }
    const targetPath = path.join(userdir, "uploads", filename);
    if (!fs.existsSync(path.dirname(targetPath))) {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true, mode: 0o0775 });
    }
    file.mv(targetPath, (error) => {
      if (error) {
        console.error(error);
        return res.status(500).end();
      } else {
        return res.status(200).end();
      }
    });
  }
);

router.get(
  "/video",
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const project: string = req.query.project.toString();
    const filepath: string = req.query.file.toString();
    if (!project || /\.\.(\/|\\)/g.test(project)) {
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
    let fullpath;
    if (project === "") {
      fullpath = path.join(userdir, "uploads", filepath);
    } else {
      fullpath = path.join(userdir, "projects", project, filepath);
    }
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
  }
);

router.delete(
  "/project",
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const account = req.account;
    const projectname = req.body.name;
    const password = req.body.password;
    if (!projectname || /\.\.(\/|\\)/g.test(projectname)) {
      return res.status(400).json({ message: "Fehlerhafte Anfrage." }).end();
    }
    if (!account) {
      res.status(403).json({ message: "Keine Berechtigung." }).end();
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
  }
);

router.get(
  "/convert",
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const filequery: string = req.query.file.toString();
    if (!filequery) {
      return res.status(400).end();
    }
    const account = req.account;
    if (!account) {
      return res.status(403).end();
    }
    const userdir = account.getDirectory();
    const filepath = path.join(userdir, "uploads", "pdf", filequery);
    console.log(`[convert] Download for file ${filepath} requested.`);
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
  }
);

let events: Map<string, EventEmitter> = new Map();

router.get(
  "/convert/events",
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const filequery: string = req.query.file.toString();
    if (!filequery) {
      return res.status(400).end();
    }
    const account = req.account;
    if (!account) {
      return res.status(403).end();
    }
    req.on("close", () => {
      console.log(`[${filequery}] Connection closed`);
    });
    const headers = {
      "Cache-Control": "no-cache",
      "Content-Type": "text/event-stream",
      Connection: "keep-alive",
    };
    res.writeHead(200, headers);
    res.write("event: info\ndata: Warte auf Ereignisse vom Server ...\n\n");
    const id = account.username + ":" + path.basename(filequery, ".zip");
    const emitter = events.get(id);
    if (!emitter) {
      res.write("event: error\ndata: Kein Prozess gefunden.\n\n");
      return;
    }
    emitter.on("info", (event) => {
      res.write(`event: info\ndata: ${event.message}\n\n`);
    });
    emitter.on("done", (event) => {
      res.write(`event: done\ndata: ${event.message}\n\n`);
      events.delete(id);
    });
    emitter.on("error", (event) => {
      res.write(`event: error\ndata: ${event.message}\n\n`);
      events.delete(id);
    });
    emitter.emit("start");
  }
);

router.post(
  "/convert",
  fileUpload(),
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const account = req.account;
    if (!account) {
      res
        .status(403)
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
    if (Array.isArray(req.files.file)) {
      console.error("[CONVERT UPLOAD] Received multiple files.");
      return res
        .status(400)
        .json({
          message: escapeHTML(
            "Mehrere Dateien empfangen. Bitte nur eine Datei senden."
          ),
        })
        .end();
    }

    const file: fileUpload.UploadedFile = req.files.file;
    if (!file.name.endsWith(".pdf")) {
      return res.status(400).json({
        message: escapeHTML("Keine .pdf-Datei empfangen."),
      });
    }
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
      const id: string =
        account.username + ":" + path.basename(file.name, ".pdf");
      events.set(id, new EventEmitter());
      const emitter = events.get(id);
      emitter.on("start", () => {
        Converter(uploadPath, emitter);
      });
      return res
        .status(200)
        .json({ message: "Datei steht zur Konvertierung bereit." })
        .end();
    });
  }
);

export default router;
