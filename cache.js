const fs = require("fs");
const os = require("os");
const path = require("path");
const argon2 = require("argon2");
const crypto = require("crypto");

const db = require("./db");
const config = require("./config.json");
const Errors = require("./types/errors");
const { spawn } = require("child_process");

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

class Cache {
  accounts = {};

  /**
   * Authenticates the request. If there is already a logged in user, takes the session into account.
   * If there is no session, checks the request body for username and password to authenticate with instead.
   * If none is given, no account is authenticated.
   *
   * @param {*} request HTTP Request with session and body parameters to check.
   * @param {*} callback Gets called when done. Signature: callback(error, account).
   * @returns
   */
  authenticate(request, callback) {
    let user_id = undefined;
    if (request.session && request.session.user) {
      user_id = request.session.user;
      this.getAccountByID(user_id, (error, account) => {
        if (error) {
          return callback(error, undefined);
        }
        return callback(undefined, account);
      });
    } else if (request.body.username && request.body.password) {
      this.getAccountByName(request.body.username, (error, account) => {
        if (error) {
          return callback(error, undefined);
        }
        account.checkPassword(request.body.password).then((success) => {
          if (success) {
            return callback(undefined, account);
          } else {
            return callback(Errors.AUTH_FAILED, undefined);
          }
        });
      });
    }
  }

  getAccountByID(id, callback) {
    if (this.accounts[id]) {
      callback(undefined, this.accounts[id]);
    } else {
      db.getAccountByID(id)
        .then((account) => {
          callback(undefined, account);
        })
        .catch((error) => {
          callback(error, undefined);
        });
    }
  }

  getAccountByName(username, callback) {
    db.getAccountByName(username)
      .then((account) => {
        callback(undefined, account);
      })
      .catch((error) => {
        callback(error, undefined);
      });
  }

  getAllAccounts(callback) {
    db.transact("SELECT id, username, email FROM accounts", [])
      .then((result) => {
        if (result.rows.length > 0) {
          callback(undefined, result.rows);
        } else {
          callback(Errors.NO_RESULTS, undefined);
        }
      })
      .catch((error) => {
        console.error(error);
        callback(Errors.DB_ERROR, undefined);
      });
  }

  getAllRequests(callback) {
    db.transact(
      "SELECT id, username, email, token, note, created FROM account_requests",
      []
    )
      .then((result) => {
        if (result.rows.length > 0) {
          callback(undefined, result.rows);
        } else {
          callback(Errors.NO_RESULTS, undefined);
        }
      })
      .catch((error) => {
        console.error(error);
        callback(Errors.DB_ERROR, undefined);
      });
  }

  createAccount(username, password, email) {
    return new Promise((resolve, reject) => {
      try {
        argon2.hash(password).then((hash) => {
          db.transact(
            "INSERT INTO accounts(username, hash, email, created) VALUES ($1, $2, $3, NOW()) ON CONFLICT DO NOTHING",
            [username, hash, email]
          )
            .then((result) => {
              console.log(
                "[accounts]",
                `${result.command} executed. ${result.rowCount} rows affected.`
              );
            })
            .then(() => {
              const salt = makeRandomString(
                9,
                "abcdefghijklmnopqrstuvwxyz0123456789"
              );
              const shahash = crypto
                .createHash("sha256")
                .update(password + salt)
                .digest("hex");
              return db.transact(
                "INSERT INTO feedback_accounts(username, hash, salt, email) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
                [username, shahash, salt, email]
              );
            })
            .then((result) => {
              console.log(
                "[feedback]",
                `${result.command} executed. ${result.rowCount} rows affected.`
              );
              this.exportFeedbackUsers();
              const userdir = path.join(
                config.user_directory_name,
                username,
                "projects"
              );
              fs.mkdirSync(userdir, { recursive: true });
              resolve(true);
            })
            .catch((error) => {
              reject(error);
            });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  exportFeedbackUsers() {
    const filename = config.feedback_db_file || "users.yaml";
    db.transact("SELECT * FROM feedback_accounts")
      .then((result) => {
        if (result.rows.length > 0) {
          let contents = "users:\n";
          for (const data of result.rows) {
            contents += "  " + data.username + ":\n";
            contents += "    hash: " + data.hash + "\n";
            contents += "    decks:\n";
            contents += '      - "' + data.username + '"\n';
            contents += "    salt: " + data.salt + "\n";
            contents += "    login: " + data.username + "\n";
            contents += "    email: " + data.email + "\n";
          }
          fs.writeFile(filename, contents, function (error) {
            if (error) return console.error(error);
            console.log("[export] Feedback Users written to: ", filename);
          });
        }
      })
      .catch((error) => {
        console.error(error);
      });
  }
}

const instance = new Cache();

module.exports = instance;
