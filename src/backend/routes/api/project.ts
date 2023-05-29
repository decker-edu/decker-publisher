import express from "express";
const router = express.Router();

import escapeHTML from "escape-html";

import validator from "email-validator";
import fs from "fs";
import path from "path";

import Project from "../../project";
import { getChecksums } from "../api";

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
    return res.status(200).json({ message: "dummy" }).end();
  }
);

router.get(
  "/:project/filetree",
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
    const files = getChecksums(project.directory);
    return res.status(200).json(files).end();
  }
);

export default router;
