import express from "express";

import { Request, Response, NextFunction } from "express";

import path from "path";
import fs from "fs";
import database from "../../backend/database";
import config from "@root/config";
import child_process from "child_process";
import amberscript from "../../backend/amberscript";
import { Account } from "@root/backend/account";

const router = express.Router();

import userRouter from "./user";
import { requireLogin, retrieveKeys } from "@root/util";
import getConfig from "@root/config";

router.use("/user", userRouter);

/* GET home page. */
router.get(
  "/",
  async function (req: Request, res: Response, next: NextFunction) {
    const admin =
      req.account && req.account.roles
        ? req.account.roles.includes("admin")
        : false;
    return res.render("index", {
      title: "Decker",
      admin: admin,
    });
  }
);

/* GET overview page. */
router.get(
  "/home",
  requireLogin,
  async function (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    const admin = req.account.roles
      ? req.account.roles.includes("admin")
      : false;
    return res.render("home", {
      title: "Decker: Persönlicher Bereich",
      admin: admin,
    });
  }
);

router.get(
  "/password-recovery",
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return res.render("request-recovery", {
      title: "Decker: Neues Passwort anfragen",
    });
  }
);

async function purgeOldRequests() {
  const result = await database.query(
    "DELETE FROM recovery_requests WHERE created + INTERVAL '6 hours' < NOW()"
  );
}

router.get(
  "/password-reset/",
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    res.redirect("/password-recovery");
  }
);

router.get(
  "/password-reset/:token",
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const token = req.params.token;
    if (!token) {
      return res.redirect("/password-recovery");
    }
    try {
      await purgeOldRequests();
      const reqResult = await database.query(
        "SELECT * FROM recovery_requests WHERE token = $1",
        [token]
      );
      if (reqResult.rows.length > 0) {
        const request = reqResult.rows[0];
        const account = await Account.fromDatabase(request.user_id);
        if (account) {
          res.render("password-reset", {
            title: "Decker: Passwort zurücksetzen",
            token: token,
            username: account.username,
            email: account.email,
          });
        } else {
          res.redirect("/password-recovery");
        }
      } else {
        res.redirect("/password-recovery");
      }
    } catch (error) {
      res.render("error", error);
    }
  }
);

router.get(
  "/profile",
  requireLogin,
  retrieveKeys,
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const admin = req.account.roles
      ? req.account.roles.includes("admin")
      : false;
    return res.render("profile", {
      title: "Decker: Profileinstellungen",
      admin: admin,
    });
  }
);

router.get(
  "/configuration",
  requireLogin,
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const admin = req.account.roles
      ? req.account.roles.includes("admin")
      : false;
    return res.render("configuration", {
      title: "Decker: Konfiguration",
      admin: admin,
    });
  }
);

router.get(
  "/projects",
  requireLogin,
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const projects = req.account.getProjects();
    const admin = req.account.roles
      ? req.account.roles.includes("admin")
      : false;
    return res.render("projects", {
      title: "Projektübersicht",
      admin: admin,
      projects: projects,
    });
  }
);

router.get(
  "/convert",
  requireLogin,
  async function (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    const admin = req.account.roles
      ? req.account.roles.includes("admin")
      : false;
    return res.render("convert", {
      title: "Decker: PDF-Konvertierung",
      admin: admin,
    });
  }
);

router.get(
  "/video",
  requireLogin,
  async function (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    const account = req.account;
    let admin = false;
    if (account) {
      admin = account.roles ? account.roles.includes("admin") : false;
    }
    let project: string;
    if (req.query.project) {
      project = req.query.project.toString();
    }
    let filepath: string;
    if (req.query.filepath) {
      filepath = req.query.filepath.toString();
    }
    if (/\.\.(\/|\\)/g.test(project)) {
      return res.render("error", {
        message: "Projekt fehlerhaft spezifiziert.",
      });
    }
    if (!filepath || filepath === "" || /\.\.(\/|\\)/g.test(filepath)) {
      return res.render("error", {
        message: "Video nicht oder fehlerhaft spezifiziert.",
      });
    }
    if (!req.account) {
      return res.render("error", {
        message: "Nicht authentifiziert.",
        error: { status: 403 },
      });
    }
    const userdir = req.account.getDirectory();
    let fullpath;
    let videoAccessURL;
    if (!project) {
      fullpath = path.join(userdir, "uploads", filepath);
      videoAccessURL =
        "/" + ["api", "user", account.username, "files", filepath].join("/");
    } else {
      fullpath = path.join(userdir, "projects", project, filepath);
      videoAccessURL =
        "/" +
        ["api", "project", account.username, project, "files", filepath].join(
          "/"
        );
    }
    const vttAccessURL = path.join(
      path.dirname(videoAccessURL),
      path.basename(videoAccessURL, path.extname(videoAccessURL) + ".vtt")
    );
    const filename = path.basename(fullpath, path.extname(fullpath));
    const dirname = path.dirname(fullpath);
    const subtitles = filename + ".vtt";
    const vttpath = path.join(
      path.dirname(filepath),
      path.basename(filepath, path.extname(filepath)) + ".vtt"
    );
    const vttfile = path.join(dirname, subtitles);
    let vttcontent = undefined;
    if (fs.existsSync(vttfile)) {
      vttcontent = fs.readFileSync(vttfile, { encoding: "utf8", flag: "r" });
    }
    let glossaries = [];
    try {
      const result = await database.query(
        "SELECT * FROM amberscript_glossaries WHERE user_id = $1",
        [account.id]
      );
      if (result && result.rows.length > 0) {
        for (const glossary of result.rows) {
          glossaries.push({ id: glossary.glossary_id, name: glossary.name });
        }
      }
    } catch (error) {
      console.error(error);
    }
    return res.render("video", {
      title: "Videoinformationen",
      admin: admin,
      video: {
        url: videoAccessURL,
        project: project,
        path: filepath,
        vtt: vttcontent,
        vttpath: vttpath,
        vtturl: vttAccessURL,
      },
      glossaries: glossaries,
    });
  }
);

router.get(
  "/ambers",
  async function (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    let admin = false;
    let jobs = [];
    const account: IAccount = req.account;
    if (account) {
      admin = account.roles ? account.roles.includes("admin") : false;
      jobs = await amberscript.getJobs(account);
      return res.render("ambers", {
        title: "Amberscript Videos",
        admin: admin,
        jobs: jobs,
      });
    } else {
      return res.redirect("/");
    }
  }
);

interface GlossaryData {
  name: string;
  id: string;
}

router.get(
  "/glossaries",
  async function (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    let admin = false;
    let glossaries: GlossaryData[] = [];
    const account = req.account;
    if (account) {
      try {
        const query = await database.query(
          "SELECT * from amberscript_glossaries WHERE user_id = $1",
          [account.id]
        );
        if (query && query.rows.length > 0) {
          for (const entry of query.rows) {
            glossaries.push({ name: entry.name, id: entry.glossary_id });
          }
        }
        admin = account.roles ? account.roles.includes("admin") : false;
        return res.render("glossaries", {
          title: "Amberscript Glossarübersicht",
          admin: admin,
          glossaries: glossaries,
        });
      } catch (error) {
        console.error(error);
        return res.render("error", error);
      }
    } else {
      return res.redirect("/");
    }
  }
);

router.get(
  "/amberscript/glossary/new",
  async function (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    let admin = false;
    const account = req.account;
    if (account) {
      admin = account.roles ? account.roles.includes("admin") : false;
      return res.render("edit-glossary", {
        title: "Amberscript Glossar",
        admin: admin,
      });
    } else {
      return res.redirect("/");
    }
  }
);

router.get(
  "/amberscript/glossary/:id",
  async function (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    let admin = false;
    const account = req.account;
    const glossary_id = req.params.id;
    if (account) {
      const owner = await amberscript.glossaryOwner(glossary_id);
      if (account.id != owner) {
        return res.redirect("/");
      }
      const glossary = await amberscript.getGlossary(glossary_id);
      admin = account.roles ? account.roles.includes("admin") : false;
      return res.render("edit-glossary", {
        title: "Amberscript Glossar",
        admin: admin,
        glossary: glossary,
      });
    } else {
      return res.redirect("/");
    }
  }
);

router.get(
  "/amberscript/videos",
  async function (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    let admin = false;
    const account = req.account;
    if (account) {
      const projects = account.getProjects();
      return res.render("videos", {
        title: "Videoübersicht",
        admin: admin,
        projects: projects,
      });
    } else {
      return res.redirect("/");
    }
  }
);

router.get(
  "/data-protection",
  async function (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    let admin = false;
    const account = req.account;
    if (account) {
      admin = account.roles ? account.roles.includes("admin") : false;
    }
    return res.render("data-protection", {
      title: "Datenschutzerklärung",
      admin: admin,
    });
  }
);

router.get(
  "/sync/:username/:projectname",
  async function (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    const account = req.account;
    const username = req.params.username;
    const projectname = req.params.projectname;
    if (!account) {
      return res.render("error", {
        message: "Sie sind nicht eingeloggt.",
        error: {
          status: 403,
        },
      });
    }
    if (account.username !== username) {
      return res.render("error", {
        message: "Sie haben keine Berechtigung diese Seite zu besuchen.",
        error: {
          status: 403,
        },
      });
    }
    const projects = account.getProjects();
    const project = projects.find(
      (project, index, array) => project.name === projectname
    );
    if (!project) {
      return res.render("error", {
        message: "Kein solches Projekt gefunden.",
        error: {
          status: 404,
        },
      });
    }
    return res.render("sync", {
      title: "Dateiverwaltung für Projekt " + projectname,
    });
  }
);

router.get(
  "/register/:token",
  async function (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    try {
      const tokenstring: string = req.params.token;
      const queryResult = await database.query(
        "SELECT username, email FROM account_requests WHERE token = $1",
        [tokenstring]
      );
      if (queryResult.rows.length > 0) {
        const account_request = queryResult.rows[0];
        const username: string = account_request.username;
        const email: string = account_request.email;
        return res.render("register", {
          username: username,
          email: email,
          token: tokenstring,
        });
      } else {
        res.render("error", {
          message: "Registrierungstoken wurde nicht gefunden.",
          error: {
            status: 404,
          },
        });
      }
    } catch (error) {
      return res.render("error", {
        message: "Interner Datenbankfehler",
        error: {
          status: 500,
          stack: error.stack,
        },
      });
    }
  }
);

function getAllRecordings(
  directory: string,
  deckname: string
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    fs.readdir(directory, (err, files) => {
      if (err) {
        return reject(err);
      }
      let result: string[] = [];
      for (const file of files) {
        if (file.endsWith(".webm") && file.includes(deckname)) {
          result.push(file);
        }
      }
      resolve(result);
    });
  });
}

router.get(
  "/recordings/decks/:username/:project/:filename(*)-recording.webm",
  async function (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    const username = req.params.username;
    const projectname = req.params.project;
    const filepart = req.params.filename;
    const deckname = path.basename(filepart);
    const fullpath = path.join(
      config().user_directory_name,
      username,
      "projects",
      projectname,
      filepart + "-recording.webm"
    );
    getAllRecordings(path.dirname(fullpath), deckname)
      .then((recordings) => {
        return res.status(200).json(recordings).end();
      })
      .catch((error) => {
        return res.status(404).json([]).end();
      });
  }
);

async function runWhisper(mp4: string, lang: string) {
  const basename = path.basename(mp4, ".mp4");
  const dirname = path.dirname(mp4);
  const whisperProgram = getConfig().whisperProgram;
  const whisperModel = getConfig().whisperModel;
  if (!whisperProgram || !whisperModel) {
    return console.log(
      "[WHISPER] No whisper program or model configured. Skipping."
    );
  }
  const wav = basename + "-tmp.wav";
  const langvtt = basename + "-recording-" + lang + ".vtt";
  const envtt = basename + "-recording-en.vtt";
  const ffmpegConvertCommand = `ffmpeg -y -i ${mp4} -acodec pcm_s16le -ac 1 -ar 16000 -af speechnorm ${wav}`;
  const originalCommand = `${whisperProgram} --file ${wav} -m ${whisperModel} --language ${lang} -bs 5 -mc 0 --output-vtt --output-file ${langvtt}`;
  const translateCommand = `${whisperProgram} --file ${wav} -m ${whisperModel} --language ${lang} --translate en -bs 5 -mc 0 --output-vtt --output-file ${envtt}`;

  console.log(`[WHISPER] converting ${mp4} to ${wav}`);

  child_process.exec(
    ffmpegConvertCommand,
    { cwd: dirname },
    (error, stdout, stderr) => {
      if (error) {
        return console.error(error);
      }
      if (stdout) {
        console.log(stdout);
      }
      if (stderr) {
        console.error(stderr);
      }
      console.log("[WHISPER EXEC] Preliminary Conversion Complete");
      child_process.exec(
        originalCommand,
        { cwd: dirname },
        (error, stdout, stderr) => {
          if (error) {
            return console.error(error);
          }
          if (stdout) {
            console.log(stdout);
          }
          if (stderr) {
            console.error(stderr);
          }
          console.log("[WHISPER EXEC] Original Transcription Complete");
          child_process.exec(
            translateCommand,
            { cwd: dirname },
            (error, stdout, stderr) => {
              if (error) {
                return console.error(error);
              }
              if (stdout) {
                console.log(stdout);
              }
              if (stderr) {
                console.error(stderr);
              }
              console.log("[WHISPER EXEC] Translation Transcription Complete");
            }
          );
        }
      );
    }
  );
}

async function runFFMPEG(directory: string, deckname: string) {
  getAllRecordings(directory, deckname)
    .then((recordings) => {
      let contents = "";
      for (const recording of recordings) {
        contents += "file '" + recording + "'\n";
      }
      fs.writeFileSync(
        path.join(directory, deckname + "-recording.mp4.list"),
        contents
      );
      const command =
        "ffmpeg -nostdin -v fatal -y -f concat -safe 0 -i " +
        (deckname + "-recording.mp4.list") +
        " -pix_fmt yuv420p -crf 27 -preset veryslow -tune stillimage -ac 1 -movflags +faststart -vcodec libx264 -r 30 -metadata comment=decker-crunched -acodec aac " +
        (deckname + "-recording-tmp.mp4");
      console.log("[EXEC]", command);
      child_process.exec(
        command,
        { cwd: directory },
        (error, stdout, stderr) => {
          if (error) {
            return console.error(error);
          }
          if (stdout) {
            console.log(stdout);
          }
          if (stderr) {
            console.error(stderr);
          }
          console.log("[PUT VIDEO] ffmpeg finished");
          const tmp = path.join(directory, deckname + "-recording-tmp.mp4");
          const real = path.join(directory, deckname + "-recording.mp4");
          fs.rename(tmp, real, (err) => {
            if (err) {
              console.error(err);
            }
            console.log("[PUT VIDEO] moved file");
            runWhisper(real, "de");
          });
        }
      );
    })
    .catch((error) => {
      console.error(error);
    });
}

router.put(
  "/replace/decks/:username/:project/:filename(*)-recording.webm",
  async function (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    try {
      const username = req.params.username;
      const projectname = req.params.project;
      const filepart = req.params.filename;
      const deckname = path.basename(filepart);
      const account = req.account;
      if (account && account.username === username) {
        const userdir = account.getDirectory();
        const fullpath = path.join(
          userdir,
          "projects",
          projectname,
          filepart + "-recording.webm"
        );
        const dirname = path.dirname(fullpath);
        const recordings = await getAllRecordings(dirname, deckname);
        for (const recording of recordings) {
          const target = path.join(dirname, recording);
          try {
            fs.rmSync(target);
            console.log("[PUT VIDEO] removed", target);
          } catch (error) {
            console.error("[PUT VIDEO] error trying to remove", target);
          }
        }
        const writePath = path.join(dirname, deckname + "-recording.webm");
        const stream = fs.createWriteStream(writePath);
        req.pipe(stream);
        stream.on("close", () => {
          res.status(200).end();
          runFFMPEG(dirname, deckname);
        });
        return;
      } else {
        return res.status(403).end();
      }
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Interner Fehler." }).end();
    }
  }
);

router.put(
  "/append/decks/:username/:project/:filename(*)-recording.webm",
  async function (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    try {
      const username = req.params.username;
      const projectname = req.params.project;
      const filepart = req.params.filename;
      const deckname = path.basename(filepart);
      const account = req.account;
      if (account && account.username === username) {
        const userdir = account.getDirectory();
        const fullpath = path.join(
          userdir,
          "projects",
          projectname,
          filepart + "-recording.webm"
        );
        const dirname = path.dirname(fullpath);
        const recordings = await getAllRecordings(dirname, deckname);
        for (const recording of recordings) {
          if (recording === deckname + "-recording.webm") {
            fs.renameSync(
              path.join(dirname, deckname + "-recording.webm"),
              path.join(dirname, deckname + "-recording-0.webm")
            );
            console.log(
              "[PUT VIDEO] renamed",
              path.join(dirname, deckname + "-recording.webm"),
              "to",
              path.join(dirname, deckname + "-recording-0.webm")
            );
          }
        }
        const writePath = path.join(
          dirname,
          deckname +
            "-recording" +
            (recordings.length > 0 ? "-" + recordings.length : "") +
            ".webm"
        );
        const stream = fs.createWriteStream(writePath);
        req.pipe(stream);
        stream.on("close", () => {
          console.log(
            "[PUT VIDEO] wrote",
            path.join(
              dirname,
              deckname + "-recording-" + recordings.length + ".webm"
            )
          );
          res.status(200).end();
          runFFMPEG(dirname, deckname);
        });
        return;
      } else {
        return res.send(403).end();
      }
    } catch (error) {
      return res.status(500).json({ message: "Interner Fehler" }).end();
    }
  }
);

router.get(
  "/favicon.ico",
  (req: Request, res: Response, next: NextFunction) => {
    const root = rootDirectory;
    const filepath = path.join(
      rootDirectory,
      "static",
      "images",
      "favicon.png"
    );
    return res.sendFile(filepath);
  }
);

router.get("/error", (req: Request, res: Response, next: NextFunction) => {
  const account = req.account;
  let admin = false;
  if (account) {
    admin = account.roles.includes("admin");
  }
  return res.render("index", {
    title: "Decker",
    admin: admin,
  });
});

export default router;
