import { Account } from "./account";

import FormData from "form-data";
import fetch from "node-fetch";

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

  const url = new URL("https://api.amberscript.com/api/jobs/upload-media");
  const params = {
    apiKey: apiKey,
    transcriptionType: "captions",
    jobType: "direct",
    language: "de",
    numberOfSpeakers: "1",
    callbackUrl: config.amberscriptCallbackUrl,
  };
  url.search = new URLSearchParams(params).toString();
  const form = new FormData();
  const stream = fs.createReadStream(filepath);
  form.append("file", stream);
  try {
    const response = await fetch(url, { method: "POST", body: form });
    if (response.ok) {
      const json: any = await response.json();
      const status = json.jobStatus.status;
      const jobID = json.jobStatus.jobId;
      archive(account, project, filename, jobID, status);
    } else {
      throw "Request not accepted: " + response.status;
    }
  } catch (error) {
    throw error;
  }
}

async function finallizeJob(jobId: string, status: string) {
  if (status != "DONE") {
    return;
  }
  try {
    const jobQuery = await database.query(
      "SELECT * FROM amberscript_jobs WHERE job_id = $1",
      [jobId]
    );
    if (jobQuery && jobQuery.rows.length > 0) {
      const job = jobQuery.rows[0];
      await database.query(
        "UPDATE amberscript_jobs SET status = $1 WHERE job_id = $2",
        [status, jobId]
      );
      await importVTT(jobId);
    }
  } catch (error) {
    console.error(error);
  }
}

async function archive(
  account: Account,
  projectname: string,
  filename: string,
  jobId: string,
  status: string
) {
  if (!account || !projectname || !filename || !jobId || !status) {
    console.error("Not enough data to archive job.");
    return;
  }
  const user_id = account.id;
  if (!status) {
    status = "OPEN";
  }
  console.log(
    `[amberscript] creating new job: ${jobId}, ${user_id}, ${projectname}, ${filename}, ${status}`
  );
  try {
    await database.query(
      "INSERT INTO amberscript_jobs (job_id, user_id, projectname, relative_filepath, status) VALUES ($1, $2, $3, $4, $5)",
      [jobId, user_id, projectname, filename, status]
    );
    console.log("[amberscript] new job created at: ", Date.now());
  } catch (error) {
    console.error(error);
  }
}

async function getVTT(jobId: string): Promise<string> {
  const url = new URL("https://api.amberscript.com/api/jobs/export-vtt");
  const apiKey = config.amberscriptAPIKey;
  if (!apiKey || apiKey === "") {
    throw "No API Key specified";
  }
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

async function importVTT(jobId: string) {
  try {
    if (!jobId || jobId === "") {
      throw "No jobId specified.";
    }

    const queryResult = await database.query(
      "SELECT * from amberscript_jobs WHERE job_id = $1",
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
      const text = await getVTT(jobId);
      fs.writeFileSync(subtitleFile, text);
    }
  } catch (error) {}
}

async function publishError(jobId: string, status: string) {
  console.log("[TODO] Implement error publishing Amber");
}

export default {
  post,
  archive,
  importVTT,
  finallizeJob,
  publishError,
};
