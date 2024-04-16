import { Account } from "./account";
import { randomString } from "../util";
import database from "./database";
import config from "@root/config";

import fs from "fs";
import crypto from "crypto";

/* Because the old feedback system uses sha256 */
function encryptPassword(password: string, salt: string) {
  const hash = crypto
    .createHash("sha256")
    .update(password + salt)
    .digest("hex");
  return hash;
}

export async function exportFeedbackUsers() {
  try {
    const filename = config().feedback_db_file || "users.yaml";
    const hostname = config().hostname;
    const all = await database.query("SELECT * FROM feedback_accounts");
    if (all.rows.length > 0) {
      let contents = "users:\n";
      for (const data of all.rows) {
        contents += "  " + data.username + ":\n";
        contents += "    hash: " + data.hash + "\n";
        contents += "    decks:\n";
        contents += '      - "' + data.username + '"\n';
        if (hostname) {
          contents +=
            '      - "' + hostname + "/decks/" + data.username + '"\n';
        }
        contents += "    salt: " + data.salt + "\n";
        contents += "    login: " + data.username + "\n";
        contents += "    email: " + data.email + "\n";
      }
      fs.writeFile(filename, contents, function (error) {
        if (error) return console.error(error);
        console.log("[export] feedback_accounts exported to: ", filename);
      });
    }
  } catch (error) {
    console.error(error);
  }
}

export default async function setup() {
  Account.on(
    "registration",
    async (username: string, password: string, email: string) => {
      const salt = randomString(9, "abcdefghijklmnopqrstuvwxyz0123456789");
      const hash = encryptPassword(password, salt);
      const query = await database.query(
        `INSERT INTO feedback_accounts(username, hash, salt, email)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT DO NOTHING RETURNING id`,
        [username, hash, salt, email]
      );
      if (query && query.rows.length > 0) {
        const id = query.rows[0].id;
        console.log(
          `[feedback_accounts] created account ${username} with id: ${id}.`
        );
        exportFeedbackUsers();
      }
    }
  );

  Account.on(
    "passwordChange",
    async (username: string, password: string, email: string) => {
      const salt = randomString(9, "abcdefghijklmnopqrstuvwxyz0123456789");
      const hash = encryptPassword(password, salt);
      const query = await database.query(
        `UPDATE feedback_accounts SET hash = $2, salt = $3 WHERE username = $1`,
        [username, hash, salt]
      );
      if (query) {
        console.log(`[feedback_accounts] changed ${username}'s password.`);
        exportFeedbackUsers();
      }
    }
  );

  Account.on(
    "emailChange",
    async (username: string, password: string, email: string) => {
      const query = await database.query(
        `UPDATE feedback_accounts SET email = $2 WHERE username = $1`,
        [username, email]
      );
      if (query) {
        console.log(
          `[feedback_accounts] changed ${username}'s email to ${email}.`
        );
        exportFeedbackUsers();
      }
    }
  );
}
