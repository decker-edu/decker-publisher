const express = require("express");
const router = express.Router();

const path = require("path");
const fs = require("fs");
const db = require("../db");
const config = require("../config.json");
const cache = require("../cache");
const Errors = require("../types/errors");
const child_process = require("child_process");

/* GET home page. */
router.get("/", async function (req, res, next) {
  res.render("index", {
    title: "Decker",
    admin: false,
    user: req.account,
  });
});

router.get("/home", async function (req, res, next) {
  if (!req.account) {
    return res.redirect("/");
  }
  account.hasRole("admin", (error, admin) => {
    if (error) {
      console.error(error);
      admin = false;
    }
    res.render("home", {
      title: "Persönlicher Bereich",
      admin: admin,
      user: req.account,
    });
  });
});

router.get("/profile", (req, res, next) => {
  if (!req.account) {
    res.send("error");
  }
});

router.get("/projects", (req, res, next) => {
  cache.authenticate(req, (error, account) => {
    if (error) {
      return res.redirect("/");
    }
    if (!account) {
      return res.redirect("/");
    }
    account.getProjects((projects) => {
      account.hasRole("admin", (error, admin) => {
        if (error) {
          console.error(error);
          admin = false;
        }
        res.render("projects", {
          title: "Projektübersicht",
          admin: admin,
          user: { username: account.username },
          projects: projects,
        });
      });
    });
  });
});

router.get("/convert", async function (req, res, next) {
  cache.authenticate(req, (error, account) => {
    if (error) {
      return res.redirect("/");
    }
    if (!account) {
      return res.redirect("/");
    }
    account.hasRole("admin", (error, admin) => {
      if (error) {
        console.error(error);
        admin = false;
      }
      res.render("convert", {
        title: "PDF Umwandeln",
        admin: admin,
        user: { username: account.username },
      });
    });
  });
});

router.get("/video", async function (req, res, next) {
  let project = req.query.project;
  let filepath = req.query.filepath;
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
  const userdir = req.account.getUserDirectory();
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
    video: {
      url: path.join("decks", req.account.username, project, filepath),
      project: project,
      path: filepath,
      vtt: vttcontent,
    },
  });
});

router.get("/data-protection", async function (req, res, next) {
  return res.render("data-protection", {
    title: "Datenschutzhinweise",
    user: req.account,
  });
});

router.get("/sync", async function (req, res, next) {
  return res.render("sync", {
    title: "Sync",
    user: req.account,
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

function getAllRecordings(directory, deckname) {
  return new Promise((resolve, reject) => {
    fs.readdir(directory, (err, files) => {
      if (err) {
        return reject(err);
      }
      let result = [];
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
  "/recordings/decks/:username/:project/*-recording.webm",
  async function (req, res, next) {
    const username = req.params.username;
    const projectname = req.params.project;
    const filepart = req.params[0];
    const deckname = path.basename(filepart);
    const fullpath = path.join(
      config.user_directory_name,
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

async function runFFMPEG(directory, deckname) {
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
  "/replace/decks/:username/:project/*-recording.webm",
  async function (req, res, next) {
    const username = req.params.username;
    const projectname = req.params.project;
    const filepart = req.params[0];
    const deckname = path.basename(filepart);
    const fullpath = path.join(
      config.user_directory_name,
      username,
      "projects",
      projectname,
      filepart + "-recording.webm"
    );
    const dirname = path.dirname(fullpath);
    cache.authenticate(req, (error, account) => {
      if (error) {
        return res.status(403).end();
      }
      if (account && account.username === username) {
        getAllRecordings(path.dirname(fullpath), deckname)
          .then((recordings) => {
            for (const recording of recordings) {
              const target = path.join(dirname, recording);
              fs.rm(target, (error) => {
                if (error) {
                  console.error(error);
                }
                console.log("[PUT VIDEO] removed", target);
              });
            }
            req
              .pipe(
                fs.createWriteStream(
                  path.join(dirname, deckname + "-recording.webm")
                )
              )
              .on("close", () => {
                runFFMPEG(dirname, deckname);
              });
            res.status(200).end();
          })
          .catch((error) => {
            console.error(error);
            res.status(500).end();
          });
      }
    });
  }
);

router.put(
  "/append/decks/:username/:project/*-recording.webm",
  async function (req, res, next) {
    const username = req.params.username;
    const projectname = req.params.project;
    const filepart = req.params[0];
    const deckname = path.basename(filepart);
    const fullpath = path.join(
      config.user_directory_name,
      username,
      "projects",
      projectname,
      filepart + "-recording.webm"
    );
    const dirname = path.dirname(fullpath);
    cache.authenticate(req, (error, account) => {
      if (error) {
        return res.status(403).end();
      }
      if (account && account.username === username) {
        getAllRecordings(path.dirname(fullpath), deckname)
          .then((recordings) => {
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
            req
              .pipe(
                fs.createWriteStream(
                  path.join(
                    dirname,
                    deckname +
                      "-recording" +
                      (recordings.length > 0 ? "-" + recordings.length : "") +
                      ".webm"
                  )
                )
              )
              .on("close", () => {
                console.log(
                  "[PUT VIDEO] wrote",
                  path.join(
                    dirname,
                    deckname + "-recording-" + recordings.length + ".webm"
                  )
                );
                runFFMPEG(dirname, deckname);
              });
            return res.status(200).end();
          })
          .catch((error) => {
            console.error(error);
            return res.status(500).end();
          });
      }
    });
  }
);

router.get("favicon.ico", (req, res, next) => {
  return res.sendFile("public/images/favicon.png");
});

module.exports = router;
