const fs = require("fs");
const crypto = require("crypto");

const pdf = require("pdf-parse");
const child_process = require("child_process");

const db = require("./db.js");
const cache = require("./cache");

(async function () {
  const filename = "accessibility-test.pdf";
  const parts = filename.split(".");
  const name = parts[0];
  const fileend = parts[1];
  console.log(fileend);
  let data = fs.readFileSync("uploads/tmp/asdf/" + filename);
  pdf(data).then((data) => {
    console.log(data);
  });
  fs.mkdirSync("uploads/tmp/asdf/" + name + "/");
  child_process.exec(
    `pdf2svg uploads/tmp/asdf/${name}.pdf uploads/tmp/asdf/${name}/${name}-page-%03d.svg all`,
    (error, stdout, stderr) => {
      if (error) {
        console.error(error);
      }
      if (stdout) {
        console.log(`[stdout] ${stdout}`);
      }
      if (stderr) {
        console.log(`[stderr] ${stderr}`);
      }
    }
  );
})();
