import express from "express";

import { Request, Response, NextFunction } from "express";

import path from "path";
import fs from "fs";
import database from "../../backend/database";
import config from "../../../config.json";
import child_process from "child_process";
import { getChecksums } from "../../backend/routes/api";

const router = express.Router();

function requiresLogin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (!req.account) {
    res.redirect("/");
  } else {
    next();
  }
}

async function retrieveKeys(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  req.account.keys = await req.account.getKeys();
  next();
}

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
      user: req.account,
    });
  }
);

/* GET overview page. */
router.get(
  "/home",
  requiresLogin,
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
      user: req.account,
    });
  }
);

router.get(
  "/profile",
  requiresLogin,
  retrieveKeys,
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const admin = req.account.roles
      ? req.account.roles.includes("admin")
      : false;
    return res.render("profile", {
      title: "Decker: Profileinstellungen",
      admin: admin,
      user: req.account,
    });
  }
);

router.get(
  "/configuration",
  requiresLogin,
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const admin = req.account.roles
      ? req.account.roles.includes("admin")
      : false;
    return res.render("configuration", {
      title: "Decker: Konfiguration",
      admin: admin,
      user: req.account,
    });
  }
);

router.get(
  "/projects",
  requiresLogin,
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
      user: req.account,
      projects: projects,
    });
  }
);

router.get(
  "/convert",
  requiresLogin,
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
      user: req.account,
    });
  }
);

router.get(
  "/video",
  requiresLogin,
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
    let project: string = req.query.project.toString();
    let filepath: string = req.query.filepath.toString();
    if (!project || project === "" || /\.\.(\/|\\)/g.test(project)) {
      return res.render("error", {
        message: "Projekt nicht oder fehlerhaft spezifiziert.",
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
    const fullpath = path.join(userdir, "projects", project, filepath);
    const filename = path.basename(fullpath, path.extname(fullpath));
    const dirname = path.dirname(fullpath);
    const subtitles = filename + ".vtt";
    const vttfile = path.join(dirname, subtitles);
    let vttcontent = undefined;
    if (fs.existsSync(vttfile)) {
      vttcontent = fs.readFileSync(vttfile, { encoding: "utf8", flag: "r" });
    }
    return res.render("video", {
      title: "Videoinformationen",
      user: req.account,
      admin: admin,
      video: {
        url: path.join("decks", req.account.username, project, filepath),
        project: project,
        path: filepath,
        vtt: vttcontent,
      },
    });
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
      title: "Datenschutzhinweise",
      admin: admin,
      user: account,
    });
  }
);

router.get(
  "/sync/:projectname",
  async function (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    const account = req.account;
    const projectname = req.params.projectname;
    if (!account) {
      return res.redirect("/");
    }
    const projects = account.getProjects();
    const project = projects.find(
      (project, index, array) => project.name === projectname
    );
    if (!project) {
      return res.redirect("/");
    }
    const files = getChecksums(project.directory);
    const fileJSON = JSON.stringify(files);
    return res.render("sync", {
      title: "Sync",
      files: fileJSON,
      user: req.account,
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
  "/recordings/decks/:username/:project/:filename-recording.webm",
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
      config.user_directory_name,
      username,
      "projects",
      projectname,
      filepart + "-recording.webm"
    );
    console.log("getting", fullpath, deckname);
    getAllRecordings(path.dirname(fullpath), deckname)
      .then((recordings) => {
        return res.status(200).json(recordings).end();
      })
      .catch((error) => {
        return res.status(404).json([]).end();
      });
  }
);

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
        (deckname + "-recording.mp4");
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
            console.log(stderr);
          }
          console.log("[PUT VIDEO] ffmpeg finished");
        }
      );
    })
    .catch((error) => {
      console.error(error);
    });
}

router.put(
  "/replace/decks/:username/:project/:filename-recording.webm",
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
      const userdir = account.getDirectory();
      const fullpath = path.join(
        userdir,
        "projects",
        projectname,
        filepart + "-recording.webm"
      );
      const dirname = path.dirname(fullpath);
      if (account && account.username === username) {
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
      }
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Interner Fehler." }).end();
    }
  }
);

router.put(
  "/append/decks/:username/:project/:filename-recording.webm",
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
      const userdir = account.getDirectory();
      const fullpath = path.join(
        userdir,
        "projects",
        projectname,
        filepart + "-recording.webm"
      );
      const dirname = path.dirname(fullpath);
      if (account && account.username === username) {
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
      "frontend",
      "static",
      "images",
      "favicon.png"
    );
    return res.sendFile(filepath);
  }
);

router.get("/error", (req: Request, res: Response, next: NextFunction) => {
  const account = req.account;
  const admin = account.roles.includes("admin");
  return res.render("index", {
    title: "Decker",
    admin: admin,
    user: req.account,
  });
});

export default router;
