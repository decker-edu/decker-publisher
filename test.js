const fs = require("fs");
const path = require("path");

const pdfjs = require("pdfjs-dist/legacy/build/pdf");
const child_process = require("child_process");

const config = require("./config.json");

const converter = require("./converter");

(async function () {
  let filepath = path.join(
    config.user_directory_name,
    "asdf",
    "uploads",
    "slides.pdf"
  );
  console.log(filepath);
  converter.convertPDF(filepath);
})();
