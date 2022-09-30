const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const pdfjs = require("pdfjs-dist/legacy/build/pdf");
const child_process = require("child_process");

const config = require("./config.json");

const converter = require("./converter");

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
