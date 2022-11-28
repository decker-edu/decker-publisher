const fs = require("fs");
const path = require("path");
const db = require("./db");
const config = require("./config.json");

async function post(account, project, filename, apiKey) {
  const filepath = path.join(
    account.getUserDirectory(),
    "projects",
    projectname,
    filename
  );

  if (!config.amberscriptCallbackUrl || config.amberscriptCallbackUrl === "") {
    throw "No Amberscript Callback URL specified.";
  }

  if (!apiKey || apiKey === "") {
    throw "No API Key available.";
  }

  if (!fs.existsSync(filepath)) {
    throw "File not Found";
  }

  let url = new URL("https://api.amberscript.com/api/jobs/upload-media");
  const params = {
    apiKey: apiKey,
    transcriptionType: "captions",
    jobType: "direct",
    language: "de",
    callbackUrl: config.amberscriptCallbackUrl,
    numberOfSpeakers: "1",
  };
  url.search = new URLSearchParams(params).toString();
  const form = new FormData();
  form.append("file", fs.createReadStream(filepath));
  fetch(url, { method: "POST", body: form })
    .then((response) => {
      if (response.ok) {
        return response.json();
      } else {
        throw "Request not accepted: " + response.status;
      }
    })
    .then((json) => {
      const status = json.jobStatus;
      const jobID = status.jobId;
      archive(account, project, filename, jobID, status);
    })
    .catch((error) => {
      throw error;
    });
}

async function finallizeJob(jobID, status) {}

async function archive(account, projectname, filename, jobId, jobstate) {
  const user_id = account.id;
  if (!jobstate) {
    jobstate = "OPEN";
  }
  db.transact(
    "INSERT INTO amberscript_jobs (user_id, jobId, projectname, relative_filepath, jobstate) VALUES ($1, $2, $3, $4, $5)",
    [user_id, jobId, projectname, filename, jobstate]
  );
}

function getVTT(jobId, apiKey) {
  return new Promise((resolve, reject) => {
    let url = new URL("https://api.amberscript.com/api/jobs/export-vtt");
    const params = {
      jobId: jobId,
      apiKey: apiKey,
    };
    url.search = new URLSearchParams(params).toString();
    fetch(url).then((response) => {
      if (response.ok) {
        response.text().then((text) => {
          resolve(text);
        });
      } else {
        reject(response.status);
      }
    });
  });
}

async function importVTT(jobId, apiKey) {
  return new Promise((resolve, reject) => {
    if (!jobId || jobId === "") {
      throw "No jobId specified.";
    }
    if (!apiKey || apiKey === "") {
      throw "No apiKey specified.";
    }
    db.transact("SELECT * from amberscript_jobs WHERE jobId = $1", [
      jobId,
    ]).then((result) => {
      if (result && result.rows.length > 0) {
        const job = result.rows[0];
        const user_id = job.user_id;
        const projectname = job.projectname;
        const filename = job.relative_filepath;
        db.getAccountByID(user_id)
          .then((account) => {
            const userdir = account.getUserDirectory();
            const fullpath = path.join(
              userdir,
              "projects",
              projectname,
              filename
            );
            const dirname = path.dirname(filename);
            const stem = path.basename(filename, path.extname(filename));
            const subtitleFile = path.join(dirname, stem + ".vtt");
            getVTT(jobId, apiKey)
              .then((text) => {
                fs.writeFileSync(subtitleFile, text);
                resolve(true);
              })
              .catch((error) => {
                console.error(error);
                reject(false);
              });
          })
          .catch((error) => {
            console.error(error);
            reject(false);
          });
      }
    });
  });
}

module.exports.post = post;
module.exports.archive = archive;
module.exports.import = importVTT;
