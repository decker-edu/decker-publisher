import express from "express";
const router = express.Router();

import escapeHTML from "escape-html";
import html2text from "html-to-text";
const rake = require("node-rake");
import md5 from "apache-md5";

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
  "/:username/:project/access",
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
    if (fs.existsSync(path.join(dir, ".htpasswd"))) {
      const content = fs.readFileSync(path.join(dir, ".htpasswd"), "utf-8");
      const parts = content.split(":");
      const htuser = parts[0];
      return res.status(200).json({ htuser: htuser }).end();
    } else {
      return res
        .status(404)
        .json({ message: escapeHTML(".htpasswd nicht gefunden.") })
        .end();
    }
  }
);

router.post(
  "/:username/:project/access",
  requireBody("htuser"),
  requireBody("htpass"),
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
    const htuser = req.body["htuser"];
    const htpass = md5(req.body["htpass"]);
    const dir = project.directory;
    try {
      fs.writeFileSync(path.join(dir, ".htpasswd"), `${htuser}:${htpass}`);
      return res.status(200).end();
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "Kann nicht in .htpasswd Datei schreiben." })
        .end();
    }
  }
);

router.delete(
  "/:username/:project/access",
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
    const filename = path.join(dir, ".htpasswd");
    try {
      if (fs.existsSync(filename)) fs.rmSync(filename);
      return res.status(200).end();
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ message: "Kann .htpasswd Datei nicht löschen." })
        .end();
    }
  }
);

router.get(
  "/:username/:project/files/:filename(*)",
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
  "/:username/:project/files/:filename(*)",
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
      return res
        .status(400)
        .json({ message: "Es wurde keine Datei hochgeladen." })
        .end();
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
      if (await project.writeFile(filename, file.data)) {
        return res.status(200).end();
      } else {
        return res.status(500).end();
      }
    } catch (error) {
      return res.status(500).end();
    }
  }
);

router.delete(
  "/:username/:project/files/:filename(*)",
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
    try {
      if (await project.deleteFile(filename)) {
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
  "/:username/:project/files",
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
  "/:username/:project/decks",
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
    const allFiles = await project.getFiles();
    const decks = [];
    for (const file of allFiles) {
      if (file.endsWith("-deck.html")) {
        decks.push(file);
      }
    }
    return res.status(200).json({ decks: decks }).end();
  }
);

router.get(
  "/:username/:project/keywords/:deck",
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
    const deck = req.params.deck;
    const contents = await project.readFile(deck);
    const text = html2text.convert(contents);
    const keywords = rake.generate(text);
    return res.status(200).json({ keywords: keywords }).end();
  }
);

export default router;
