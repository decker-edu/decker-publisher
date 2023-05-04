import express from "express";
const router = express.Router();

import fs from "fs";
import path from "path";

import amberscript from "../../amberscript";

router.post(
  "/",
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (!req.account) {
      return res.status(403).end();
    }
    const project = req.body.project || req.query.project;
    const filepath = req.body.filepath || req.query.filepath;
    const speakers = req.body.speakers || req.query.speakers;
    const language = req.body.language || req.query.language;
    const glossary = req.body.glossary || req.query.glossary;
    const userdir = req.account.getDirectory();
    const fullpath = path.join(userdir, "projects", project, filepath);

    if (!fs.existsSync(fullpath)) {
      return res.status(404).json({ message: "Datei nicht gefunden." }).end();
    }
    try {
      await amberscript.post(
        req.account,
        project,
        filepath,
        speakers,
        language,
        glossary
      );
      return res.status(200).end();
    } catch (error) {
      console.error(error);
      return res.status(500).end();
    }
  }
);

router.post(
  "/callback",
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const message = req.body;
    if (!message.status) {
      return res.status(400).json({ message: "Fehlerhafte Anfrage." }).end();
    }
    if (message.status && message.jobId) {
      const status = message.status;
      const jobId = message.jobId;
      if (status === "DONE") {
        amberscript.finallizeJob(jobId, status);
      } else if (status === "ERROR") {
        amberscript.publishError(jobId, message.jobStatus.errorMsg);
      } else {
        return res.status(400).end();
      }
    }
    return res.status(200).end();
  }
);

router.post(
  "/glossary",
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const account = req.account;
    if (!account) {
      return res.status(401).end();
    }
    const name = req.body.name;
    const names = req.body.names;
    const items = req.body.items;
    if (!name || name === "" || !names || !items) {
      return res.status(400).json({ message: "Fehlerhafte Anfrage." }).end();
    }
    try {
      await amberscript.createGlossary(account, name, names, items);
      return res.status(200).end();
    } catch (error) {
      return res.status(500).json({ message: error }).end();
    }
  }
);

router.get(
  "/glossary/:id",
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const account = req.account;
    if (!account) {
      return res.status(401).end();
    }
    const id = req.params.id;
    if (!id || id === "") {
      return res.status(400).end();
    }
    try {
      const owner = await amberscript.glossaryOwner(id);
      if (owner != account.id) {
        return res.status(403).end();
      }
      const glossary = await amberscript.getGlossary(id);
      return res.status(200).json(glossary).end();
    } catch (error) {
      return res.status(500).json({ message: error }).end();
    }
  }
);

router.put(
  "/glossary/:id",
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const account = req.account;
    if (!account) {
      return res.status(401).end();
    }
    const id = req.params.id;
    const name = req.body.name;
    const names = req.body.names;
    const items = req.body.items;
    if (!id || id === "" || !name || name === "" || !names || !items) {
      return res.status(400).end();
    }
    try {
      const owner = await amberscript.glossaryOwner(id);
      if (owner != account.id) {
        return res.status(403).end();
      }
      await amberscript.updateGlossary(id, name, names, items);
      return res.status(200).end();
    } catch (error) {
      return res.status(500).json({ message: error }).end();
    }
  }
);

router.delete(
  "/glossary/:id",
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const account = req.account;
    if (!account) {
      return res.status(401).end();
    }
    const confirmation = req.body.passwordConfirmation;
    const id = req.params.id;
    if (!id || id === "" || !confirmation || confirmation === "") {
      return res.status(400).end();
    }
    try {
      const owner = await amberscript.glossaryOwner(id);
      if (owner != account.id) {
        return res.status(403).json({ message: "Keine Berechtigung." }).end();
      }
      const confirmed = await account.checkPassword(confirmation);
      if (!confirmed) {
        return res.status(403).json({ message: "Falsches Passwort." }).end();
      }
      await amberscript.deleteGlossary(id);
      return res.status(200).end();
    } catch (error) {
      return res.status(500).json({ message: error }).end();
    }
  }
);

export default router;
