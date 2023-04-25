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
    const userdir = req.account.getDirectory();
    const fullpath = path.join(userdir, "projects", project, filepath);

    if (!fs.existsSync(fullpath)) {
      return res.status(404).json({ message: "Datei nicht gefunden." }).end();
    }
    try {
      await amberscript.post(req.account, project, filepath);
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
    if (!message.jobStatus) {
      return res.status(400).end();
    }
    if (message.jobStatus && message.jobStatus.jobId) {
      const jobId = message.jobStatus.jobId;
      const status = message.jobStatus.status;
      if (status === "DONE") {
        amberscript.finallizeJob(jobId, status);
      } else if (status === "ERROR") {
        amberscript.publishError(jobId, message.jobStatus.errorMsg);
      } else {
        return res.status(400).end();
      }
    }
  }
);

export default router;
