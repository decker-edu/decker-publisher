const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const db = require("./db");
const pdfjs = require("pdfjs-dist/legacy/build/pdf");
const child_process = require("child_process");

const config = require("./config.json");

const converter = require("./converter");

(async function () {
  db.transact(
    "SELECT accounts.id as id, accounts.username as username, accounts.hash as hash, array(SELECT roles.name as name from roles JOIN account_roles ON roles.id = account_roles.role_id JOIN accounts ON accounts.id = account_roles.user_id WHERE accounts.id = 3) as roles FROM accounts WHERE id = 3"
  ).then((result) => {
    console.log(result.rows[0]);
  });
})();

(async function () {
  const hash = crypto
    .createHash("sha256")
    .update("asdf" + "v8xkzxdqt")
    .digest("hex");
  return console.log(hash);
  const fullpath = path.join(
    config.user_directory_name,
    "asdf",
    "projects",
    "workshop",
    "decks",
    "presenting-recording.webm"
  );
  fs.readdir(path.dirname(fullpath), null, (err, files) => {
    if (err) return console.error(err);
    let result = [];
    for (let file of files) {
      if (file.endsWith(".webm")) {
        result.push(file);
      }
    }
    console.log(result);
  });
  return;

  let filepath = path.join(
    config.user_directory_name,
    "asdf",
    "uploads",
    "slides.pdf"
  );
  converter.convertPDF(filepath);
})();
