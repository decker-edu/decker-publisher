import { Account } from "./account";

import FormData from "form-data";
import fetch from "node-fetch";

import fs from "fs";
import path from "path";
import database from "./database";
import config from "../../config.json";

const NO_API_KEY_ERROR_MESSAGE =
  "Es wurde vom Administrator kein Amberscript-API-Schlüssel konfiguriert.";
const NO_CALLBACK_URL_ERROR_MESSAGE =
  "Es wurde vom Administrator keine Antwort-URL für Amberscript konfiguriert.";

async function post(
  account: Account,
  project: string,
  filename: string,
  speakers: string,
  language: string,
  glossary: string
) {
  const filepath = path.join(
    account.getDirectory(),
    "projects",
    project,
    filename
  );

  if (!config.amberscriptCallbackUrl || config.amberscriptCallbackUrl === "") {
    throw NO_CALLBACK_URL_ERROR_MESSAGE;
  }

  const apiKey = config.amberscriptAPIKey;

  if (!apiKey || apiKey === "") {
    throw NO_API_KEY_ERROR_MESSAGE;
  }

  if (!fs.existsSync(filepath)) {
    throw "Datei nicht gefunden.";
  }

  const url = new URL("https://api.amberscript.com/api/jobs/upload-media");
  const params = {
    apiKey: apiKey,
    transcriptionType: "captions",
    jobType: "direct",
    language: language,
    numberOfSpeakers: speakers,
    glossaryId: glossary,
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
      const dirname = path.dirname(fullpath);
      const stem = path.basename(filename, path.extname(filename));
      const subtitleFile = path.join(dirname, stem + ".vtt");
      const text = await getVTT(jobId);
      fs.writeFileSync(subtitleFile, text);
      console.log(`[amberscript] written to file ${subtitleFile}`);
    }
  } catch (error) {
    console.error(error);
  }
}

async function getJobs(account: Account) {
  const jobs = [];
  try {
    const result = await database.query(
      "SELECT * FROM amberscript_jobs WHERE user_id = $1",
      [account.id]
    );
    if (result) {
      // job_id, user_id, projectname, relative_filepath, status
      for (const job of result.rows) {
        jobs.push(job);
      }
    }
    return jobs;
  } catch (error) {
    console.error(error);
    return [];
  }
}

async function publishError(jobId: string, status: string) {
  console.log("[TODO] Implement error publishing Amber");
}

interface Glossary {
  id: string;
  name: string;
  names: string[];
  items: GlossaryItem[];
}

interface GlossaryItem {
  name: string;
  description: string;
}

async function getGlossaries(): Promise<Glossary[]> {
  const url = new URL("https://api.amberscript.com/api/glossary");
  const apiKey = config.amberscriptAPIKey;
  if (!apiKey || apiKey === "") {
    throw NO_API_KEY_ERROR_MESSAGE;
  }
  const params = {
    apiKey: apiKey,
  };
  url.search = new URLSearchParams(params).toString();
  try {
    const response = await fetch(url);
    if (response.ok) {
      const json = await response.json();
      const result: Glossary[] = [];
      for (const glossary of json) {
        result.push({
          id: glossary.id,
          name: glossary.name,
          names: glossary.names,
          items: glossary.items,
        });
      }
      return result;
    } else {
      throw "Konnte Glossarliste nicht empfangen.";
    }
  } catch (error) {
    console.error(error);
    throw "Konnte Glossarliste nicht empfangen.";
  }
}

async function getGlossary(glossary_id: string): Promise<Glossary> {
  const glossaries = await getGlossaries();
  const found = glossaries.find((glossary) => (glossary.id = glossary_id));
  if (found) {
    return found;
  } else {
    throw `Kein Glossar mit ID ${glossary_id} gefunden.`;
  }
}

async function createGlossary(
  account: Account,
  name: string,
  names: string[],
  items: GlossaryItem[]
) {
  const url = new URL("https://api.amberscript.com/api/glossary");
  const apiKey = config.amberscriptAPIKey;
  if (!apiKey || apiKey === "") {
    throw "Es wurde vom Administrator kein Amberscript API Schlüssel konfiguriert.";
  }
  const params = {
    apiKey: apiKey,
  };
  url.search = new URLSearchParams(params).toString();
  try {
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify({
        name: name,
        names: names,
        items: items,
      }),
      headers: { "Content-Type": "application/json" },
    });
    if (response.ok) {
      const data = await response.json();
      if (data.id) {
        try {
          await database.query(
            "INSERT INTO amberscript_glossaries (glossary_id, user_id, name) VALUES ($1, $2, $3)",
            [data.id, account.id, name]
          );
          console.log(
            `[amberscript] created glossary (${data.id}) for user ${account.username}`
          );
        } catch (error) {
          console.error(error);
          throw "Konnte Datenbankeintrag des Glossars nicht anlegen.";
        }
      } else {
        throw "Konnte Glossar nicht anlegen.";
      }
    }
  } catch (error) {
    console.error(error);
    throw "Konnte Glossar nicht anlegen.";
  }
}

async function glossaryOwner(id: string): Promise<number> {
  try {
    const owner = await database.query(
      "SELECT user_id FROM amberscript_glossaries WHERE glossary_id = $1",
      [id]
    );
    if (owner && owner.rows.length > 0) {
      return owner.rows[0].user_id;
    } else {
      return -1;
    }
  } catch (error) {
    console.error(error);
    throw "Datenbankfehler";
  }
}

async function updateGlossary(
  id: string,
  name: string,
  names: string[],
  items: GlossaryItem[]
) {
  const url = new URL("https://api.amberscript.com/api/glossary/" + id);
  const apiKey = config.amberscriptAPIKey;
  if (!apiKey || apiKey === "") {
    throw "Es wurde vom Administrator kein Amberscript API Schlüssel konfiguriert.";
  }
  const params = {
    apiKey: apiKey,
  };
  url.search = new URLSearchParams(params).toString();
  try {
    const response = await fetch(url, {
      method: "PUT",
      body: JSON.stringify({
        name: name,
        names: names,
        items: items,
      }),
      headers: { "Content-Type": "application/json" },
    });
    if (response.ok) {
      try {
        await database.query(
          "UPDATE amberscript_glossaries SET name = $1 WHERE glossary_id = $2",
          [name, id]
        );
        console.log(`[amberscript] glossary ${id} has been updated`);
      } catch (error) {
        throw "Konnte Datenbankeintrag des Glossars nicht aktuallisieren.";
      }
    }
  } catch (error) {
    console.error(error);
    throw "Konnte Glossar nicht aktuallisieren.";
  }
}

async function deleteGlossary(id: string) {
  const url = new URL("https://api.amberscript.com/api/glossary/" + id);
  const apiKey = config.amberscriptAPIKey;
  if (!apiKey || apiKey === "") {
    throw "Es wurde vom Administrator kein Amberscript API Schlüssel konfiguriert.";
  }
  const params = {
    apiKey: apiKey,
  };
  url.search = new URLSearchParams(params).toString();
  try {
    const response = await fetch(url, {
      method: "DELETE",
    });
    if (response.ok) {
      try {
        await database.query(
          "DELETE FROM amberscript_glossaries WHERE glossary_id = $1",
          [id]
        );
        console.log(`[amberscript] glossary ${id} has been deleted.`);
      } catch (error) {
        console.error(error);
        throw "Konnte Datenbankeintrag des Glossars nicht löschen.";
      }
    }
  } catch (error) {
    console.error(error);
    throw "Konnte Glossar nicht löschen.";
  }
}

export default {
  post,
  archive,
  importVTT,
  finallizeJob,
  publishError,
  getJobs,
  getGlossary,
  getGlossaries,
  createGlossary,
  updateGlossary,
  deleteGlossary,
  glossaryOwner,
};
