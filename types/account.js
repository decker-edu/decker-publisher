const fs = require("fs");
const path = require("path");
const argon2 = require("argon2");
const crypto = require("crypto");
const { getVideoDurationInSeconds } = require("get-video-duration");

const config = require("../config.json");

const db = require("../db");
const cache = require("../cache");
const Errors = require("./errors");

function makeRandomString(length, characters) {
  let result = "";
  let options = characters
    ? characters
    : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let amount = options.length;
  for (let i = 0; i < length; i++) {
    result += options.charAt(Math.floor(Math.random() * amount));
  }
  return result;
}

class Account {
  id;
  username;
  email;
  hash;

  constructor(id, username, email, hash) {
    this.id = id;
    this.username = username;
    this.email = email;
    this.hash = hash;
  }

  checkPassword(password) {
    return new Promise((resolve, reject) => {
      if (this.hash) {
        argon2.verify(this.hash, password).then((success) => {
          resolve(success);
        });
      } else {
        db.transact("SELECT hash FROM accounts WHERE id = $1", [this.id])
          .then((result) => {
            if (result) {
              if (result.rows.length > 0) {
                let hash = result.rows[0].hash;
                this.hash = hash;
                argon2.verify(this.hash, password).then((success) => {
                  resolve(success);
                });
              } else {
                argon2.verify(undefined, password).then((success) => {
                  resolve(success);
                });
              }
            } else {
              argon2.verify(undefined, password).then((success) => {
                resolve(success);
              });
            }
          })
          .catch((error) => {
            console.error(error);
            argon2.verify(undefined, password).then((success) => {
              resolve(success);
            });
          });
      }
    });
  }

  updatePassword(newPassword) {
    return new Promise((resolve, reject) => {
      argon2
        .hash(newPassword)
        .then((argonhash) => {
          db.transact("UPDATE accounts SET hash = $2 WHERE id = $1", [
            this.id,
            argonhash,
          ])
            .then((result) => {
              console.log(`[accounts] Updated ${this.username}'s password.`);
              const salt = makeRandomString(
                9,
                "abcdefghijklmnopqrstuvwxyz0123456789"
              );
              const shahash = crypto
                .createHash("sha256")
                .update(newPassword + salt)
                .digest("hex");
              db.transact(
                "UPDATE feedback_accounts SET hash = $2, salt = $3 WHERE id = $1",
                [this.id, shahash, salt]
              )
                .then((result) => {
                  console.log(
                    `[feedback_accounts] Updated ${this.username}'s password.`
                  );
                  resolve(true);
                })
                .catch((error) => {
                  reject(error);
                });
            })
            .catch((error) => {
              reject(error);
            });
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  updateEmail(newEmail) {
    return new Promise((resolve, reject) => {
      db.transact("UPDATE accounts SET email = $2 WHERE id = $1", [
        this.id,
        newEmail,
      ]).then((result) => {
        console.log(`[accounts] Updated ${this.username}'s E-Mail.`);
        db.transact("UPDATE feedback_accounts SET email = $2 WHERE id = $1", [
          this.id,
          newEmail,
        ])
          .then((result) => {
            console.log(
              `[feedback_accounts] Updated ${this.username}'s E-Mail.`
            );
            resolve(true);
          })
          .catch((error) => {
            reject(error);
          });
      });
    });
  }

  async getSSHKey() {
    return db
      .transact("SELECT key FROM ssh_keys WHERE username = $1", [this.username])
      .then((result) => {
        if (result.rows.length > 0) {
          return result.rows[0].key;
        } else {
          return "";
        }
      });
  }

  setSSHKey(string) {
    db.transact(
      "INSERT INTO ssh_keys (username, key) VALUES ($1, $2) ON CONFLICT DO UPDATE SET key = $2",
      [this.username, string]
    );
  }

  getUserDirectory() {
    if (config.user_directory_name.startsWith("/")) {
      return path.join(config.user_directory_name, this.username);
    } else {
      return path.join(
        global.rootDirectory,
        config.user_directory_name,
        this.username
      );
    }
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
    const userdir = this.getUserDirectory();
    const projectDir = path.join(userdir, "projects");
    let projectDirectories = this.getDirectories(projectDir);
    let projects = [];
    for (let directory of projectDirectories) {
      let mp4s = this.getFiles(directory, (file) => {
        let ext = path.extname(file);
        return ext === ".mp4";
      });
      let videoData = mp4s.map((video) => {
        return {
          filename: path.basename(video),
          filepath: path.relative(directory, video).replace(/\\/g, "/"),
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
