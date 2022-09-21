const express = require("express");
const router = express.Router();

const path = require("path");
const fs = require("fs");
const db = require("../db");
const cache = require("../cache");
const { render } = require("pug");
const Errors = require("../types/errors");

const config = require("../config.json");

router.get("/:username/:project/*", (req, res, next) => {
  const username = req.params.username;
  const projectname = req.params.project;
  const path = req.params[0] ? req.params[0] : "index.html";
  res.sendFile(path, {
    root:
      config.user_directory_name + "/" + username + "/projects/" + projectname,
  });
});

router.put("/:username/:project/*-annot.json", (req, res, next) => {
  let username = req.params.username;
  let projectname = req.params.project;
  cache.authenticate(req, (error, account) => {
    if (error) {
      return res.status(500).end();
    }
    if (account.username != username) {
      return res.status(401).end();
    }
    if (req.body) {
      let target = path.join(
        global.rootDirectory,
        config.user_directory_name,
        username,
        "projects",
        projectname,
        req.params[0] + "-annot.json"
      );
      console.log(target);
      fs.writeFile(target, JSON.stringify(req.body, null, 2), (error) => {
        if (error) {
          console.error(error);
          return res.status(500).end();
        }
      });
      return res.status(200).end();
    }
    return res.status(404).end();
  });
});

module.exports = router;
