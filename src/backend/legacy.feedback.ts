import { Account } from "./account";
import { randomString } from "../util";
import database from "./database";

import crypto from "crypto";

/* Because the old feedback system uses sha256 */
function encryptPassword(password : string, salt : string) {
    const hash = crypto.createHash("sha256").update(password + salt).digest("hex");
    return hash;
}

export default async function setup() {
    Account.on("registration", async (username : string, password : string, email : string) => {
        const salt = randomString(9, "abcdefghijklmnopqrstuvwxyz0123456789");
        const hash = encryptPassword(password, salt);
        const query = await database.query(
            `INSERT INTO feedback_accounts(username, hash, salt, email)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT DO NOTHING RETURNING id`,
             [username, hash, salt, email]);
        if(query && query.rows.length > 0) {
            const id = query.rows[0].id;
            console.log(`[feedback_accounts] Created account ${username} with id: ${id}.`);
        }
    })

    Account.on("passwordChange", async (username : string, password : string, email : string) => {
        const salt = randomString(9, "abcdefghijklmnopqrstuvwxyz0123456789");
        const hash = encryptPassword(password, salt);
        const query = await database.query(
            `UPDATE feedback_accounts SET hash = $2, salt = $3 WHERE username = $1`,
            [username, hash, salt]
        );
        if(query) {
            console.log( `[feedback_accounts] Updated ${username}'s password.` );
        }
    })
}