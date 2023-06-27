import express from "express";
const router = express.Router();

import escapeHTML from "escape-html";

import validator from "email-validator";
import fs from "fs";
import path from "path";

import Project from "../../project";
import { getChecksums } from "../api";
import fileUpload from "express-fileupload";

function isSet(value: any): boolean {
  if (!value || value === "") {
    return false;
  } else {
    return true;
  }
}

function requireBody(name: string) {
  return function (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    const field = req.body[name];
    if (isSet(field)) {
      next();
    } else {
      res
        .status(400)
        .json({ message: escapeHTML("Fehlerhafte Anfrage.") })
        .end();
    }
  };
}

router.get(
  "/",
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    return res.status(200).json({ message: "dummy" }).end();
  }
);

router.get(
  "/:username/:project/:filename(*)",
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (!req.account) {
      return res
        .status(403)
        .json({ message: escapeHTML("Nicht eingeloggt.") })
        .end();
    }
    const account = req.account;
    const username = req.params.username;
    const projectname = req.params.project;
    const filename = req.params.filename;
    if (account.username !== username) {
      return res
        .status(403)
        .json({ message: escapeHTML("Keine Berechtigung.") })
        .end();
    }
    const project = new Project(account, projectname);
    // const content = project.readFile(filename);
    return res.sendFile(path.join(project.directory, filename));
  }
);

router.post(
  "/:username/:project/:filename(*)",
  fileUpload(),
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (
      !req.files ||
      Object.keys(req.files).length === 0 ||
      Array.isArray(req.files.file)
    ) {
      return res.status(400).end();
    }
    const file: fileUpload.UploadedFile = req.files.file;
    if (!req.account) {
      return res
        .status(403)
        .json({ message: escapeHTML("Nicht eingeloggt.") })
        .end();
    }
    const account = req.account;
    const username = req.params.username;
    const projectname = req.params.project;
    const filename = req.params.filename;
    if (account.username !== username) {
      return res
        .status(403)
        .json({ message: escapeHTML("Keine Berechtigung.") })
        .end();
    }
    const project = new Project(account, projectname);
    // const content = project.readFile(filename);
    try {
      if (project.writeFile(filename, file.data)) {
        return res.status(200).end();
      } else {
        return res.status(500).end();
      }
    } catch (error) {
      return res.status(500).end();
    }
  }
);

router.get(
  "/:username/:project",
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
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
    const projectname = req.params.project;
    const projects = account.getProjects();
    const project = projects.find(
      (project, index, array) => project.name === projectname
    );
    if (!project) {
      return res
        .status(404)
        .json({ message: escapeHTML("Projekt nicht gefunden.") })
        .end();
    }
    const files = getChecksums(project.directory, project.directory);
    return res.status(200).json(files).end();
  }
);

router.get(
  "/:username/:project/htaccess",
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
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
    const projectname = req.params.project;
    const projects = account.getProjects();
    const project = projects.find(
      (project, index, array) => project.name === projectname
    );
    if (!project) {
      return res
        .status(404)
        .json({ message: escapeHTML("Projekt nicht gefunden.") })
        .end();
    }
    const dir = project.directory;
    if (fs.existsSync(path.join(dir, ".htaccess"))) {
      return res.status(200).json({ htuser: htuser, htpwd: htpwd }).end();
    } else {
      return res
        .status(404)
        .json({ message: escapeHTML(".htaccess nicht gefunden.") })
        .end();
    }
  }
);

export default router;
