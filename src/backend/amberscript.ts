import { Account } from "./account";

import fs from "fs";
import path from "path";
import database from "./database";
import config from "../../config.json";
import instance from "./database";

async function post(account: Account, project: string, filename: string) {
  const filepath = path.join(
    account.getDirectory(),
    "projects",
    project,
    filename
  );

  if (!config.amberscriptCallbackUrl || config.amberscriptCallbackUrl === "") {
    throw "No Amberscript Callback URL specified.";
  }

  const apiKey = config.amberscriptAPIKey;

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
  const buffer = fs.readFileSync(filepath);
  const contents = buffer.toString();
  form.append("file", contents);
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

async function finallizeJob(jobId: string, status: string) {
  if (status != "DONE") {
    return;
  }
  const jobQuery = await database.query(
    "SELECT * FROM amberscript_jobs WHERE jobId = $1",
    [jobId]
  );
  if (jobQuery && jobQuery.rows.length > 0) {
    const job = jobQuery.rows[0];
    await database.query(
      "UPDATE amberscript_jobs SET status = $1 WHERE jobId = $2",
      [status, jobId]
    );
    await importVTT(jobId, undefined);
  }
}

async function archive(
  account: Account,
  projectname: string,
  filename: string,
  jobId: number,
  jobstate: string
) {
  const user_id = account.id;
  if (!jobstate) {
    jobstate = "OPEN";
  }
  await database.query(
    "INSERT INTO amberscript_jobs (user_id, jobId, projectname, relative_filepath, jobstate) VALUES ($1, $2, $3, $4, $5)",
    [user_id, jobId, projectname, filename, jobstate]
  );
}

async function getVTT(jobId: string, apiKey: string): Promise<string> {
  let url = new URL("https://api.amberscript.com/api/jobs/export-vtt");
  const params = {
    jobId: jobId,
    apiKey: apiKey,
  };
  url.search = new URLSearchParams(params).toString();
  const response = await fetch(url);
  if (response.ok) {
    const text = await response.text();
    return text;
  } else {
    throw response.status;
  }
}

async function importVTT(jobId: string, apiKey: string) {
  try {
    if (!jobId || jobId === "") {
      throw "No jobId specified.";
    }
    if (!apiKey || apiKey === "") {
      throw "No apiKey specified.";
    }
    const queryResult = await database.query(
      "SELECT * from amberscript_jobs WHERE jobId = $1",
      [jobId]
    );
    if (queryResult && queryResult.rows.length > 0) {
      const job = queryResult.rows[0];
      const user_id = job.user_id;
      const projectname = job.projectname;
      const filename = job.relative_filepath;

      const account = await Account.fromDatabase(user_id);
      if (!account) {
        return;
      }
      const userdir = account.getDirectory();
      const fullpath = path.join(userdir, "projects", projectname, filename);
      const dirname = path.dirname(filename);
      const stem = path.basename(filename, path.extname(filename));
      const subtitleFile = path.join(dirname, stem + ".vtt");
      const text = await getVTT(jobId, apiKey);
      fs.writeFileSync(subtitleFile, text);
    }
  } catch (error) {}
}

async function publishError(jobId: number, status: string) {
  console.log("[TODO] Implement error publishing Amber");
}

export default {
  post,
  archive,
  importVTT,
  finallizeJob,
  publishError,
};
