const fs = require("fs");
const path = require("path");
const argon2 = require("argon2");
const { getVideoDurationInSeconds } = require("get-video-duration");

const config = require("../config.json");

const db = require("../db");
const cache = require("../cache");
const Errors = require("./errors");

class Account {
  id;
  username;
  profile;

  constructor(id, username) {
    this.id = id;
    this.username = username;
  }

  checkPassword(password, callback) {
    db.transact("SELECT hash FROM accounts WHERE id = $1", [this.id]).then(
      (result) => {
        if (result && result.rows.length > 0) {
          let hash = result.rows[0].hash;
          argon2.verify(hash, password).then(callback);
        } else {
          argon2.verify(undefined, password).then(callback);
        }
      }
    );
  }

  getUserDirectory() {
    const userdir =
      global.rootDirectory + `/${config.user_directory_name}/${this.username}/`;
    return userdir;
  }

  getFiles(filepath, filter) {
    let result = [];
    if (!fs.existsSync(filepath)) {
      return [];
    }
    let files = fs.readdirSync(filepath);
    for (let file of files) {
      let filename = path.join(filepath, file);
      let stat = fs.lstatSync(filename);
      if (stat.isDirectory()) {
        let recusion = this.getFiles(filename, filter);
        result = result.concat(recusion);
      } else {
        if (!filter || filter(file)) {
          result.push(filename);
        }
      }
    }
    return result;
  }

  getDirectories(parent) {
    let result = [];
    if (!fs.existsSync(parent)) {
      return result;
    }
    let files = fs.readdirSync(parent);
    for (let file of files) {
      let filename = path.join(parent, file);
      let stat = fs.lstatSync(filename);
      if (stat.isDirectory()) {
        result.push(filename);
      }
    }
    return result;
  }

  getProjects(callback) {
    const userdir = this.getUserDirectory() + "projects/";
    let projectDirectories = this.getDirectories(userdir);
    let projects = [];
    for (let directory of projectDirectories) {
      let mp4s = this.getFiles(directory, (file) => {
        let ext = path.extname(file);
        return ext === ".mp4";
      });
      let videoData = mp4s.map((video) => {
        return {
          filename: path.basename(video),
          filepath: path.relative(userdir, video).replace(/\\/g, "/"),
        };
      });
      projects.push({ name: path.basename(directory), videos: videoData });
    }
    callback(projects);
  }

  hasRole(rolename, callback) {
    db.transact(
      "SELECT roles.name as name from roles JOIN account_roles ON roles.id = account_roles.role_id JOIN accounts ON accounts.id = account_roles.user_id WHERE accounts.id = $1",
      [this.id]
    )
      .then((result) => {
        if (result) {
          for (let item of result.rows) {
            if (item.name === rolename) {
              callback(undefined, true);
              return;
            }
          }
          callback(undefined, false);
          return;
        } else {
          callback(Errors.NO_RESULTS, undefined);
        }
      })
      .catch((error) => {
        callback(Errors.DB_ERROR, undefined);
      });
  }

  getAmberscriptBalance(callback) {
    db.transact(
      "SELECT SUM(seconds) FROM amberscript_charges WHERE user_id = $1",
      [this.id]
    ).then((result) => {
      if (result && result.rows.length > 0) {
        callback(undefined, result.rows[0]);
      } else {
        callback(Errors.NO_RESULTS, undefined);
      }
    });
  }

  getAmberscriptCharges(callback) {
    db.transact(
      "SELECT id, seconds, caused_by FROM amberscript_charges WHERE user_id = $1",
      [this.id].then((result) => {
        if (result && result.rows.length > 0) {
          console.log(result.rows);
          callback(undefined, result.rows);
        } else {
          callback(Errors.NO_RESULTS, undefined);
        }
      })
    );
  }
}

module.exports = Account;
