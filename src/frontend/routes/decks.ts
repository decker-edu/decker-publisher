import express from "express";

import path from "path";
import fs from "fs";

import config from "@root/config";

const router = express.Router();

function getUserDirectory() {
  if (config().user_directory_name.startsWith("/")) {
    return config().user_directory_name;
  } else {
    return path.join(global.rootDirectory, config().user_directory_name);
  }
}

router.get(
  "/:username/:project",
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    return res.redirect(req.originalUrl + "/index.html");
  }
);

router.get(
  "/:username/:project/*",
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const username = req.params.username;
    const projectname = req.params.project;
    const file = req.params[0] ? req.params[0] : "index.html";
    const userdir = getUserDirectory();
    const root = path.join(userdir, username, "projects", projectname);
    return res.sendFile(file, {
      root: root,
    });
  }
);

router.put(
  "/:username/:project/*-annot.json",
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const username = req.params.username;
    const projectname = req.params.project;
    const account = req.account;
    if (account && account.username === username) {
      if (req.body) {
        const userdir = getUserDirectory();
        let target = path.join(
          userdir,
          username,
          "projects",
          projectname,
          req.params[0] + "-annot.json"
        );
        try {
          fs.writeFileSync(target, JSON.stringify(req.body, null, 2));
          return res.status(200).end();
        } catch (error) {
          console.error(error);
          return res.status(500).end();
        }
      }
    } else {
      return res.status(403).end();
    }
  }
);

router.put(
  "/:username/:project/*-times.json",
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const username = req.params.username;
    const projectname = req.params.project;
    const account = req.account;
    if (account && account.username === username) {
      if (req.body) {
        const userdir = getUserDirectory();
        let target = path.join(
          userdir,
          username,
          "projects",
          projectname,
          req.params[0] + "-times.json"
        );
        try {
          fs.writeFileSync(target, JSON.stringify(req.body, null, 2));
          return res.status(200).end();
        } catch (error) {
          console.error(error);
          return res.status(500).end();
        }
      }
    } else {
      return res.status(403).end();
    }
  }
);

export default router;
