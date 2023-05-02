import express from "express";
const router = express.Router();

import escapeHTML from "escape-html";

import validator from "email-validator";
import fs from "fs";
import path from "path";

import Project from "../../project";

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
  ":username/:project/:filename(*)",
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
  }
);
