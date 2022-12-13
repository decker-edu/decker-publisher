import database from "./database";
import { Account } from "./account";

export class AccountRequest {
    id: number;
    username: string;
    email: string;
    note: string;
    token: string;
    
    constructor(id: number, username: string, email: string, note: string, token: string) {
        this.id = id;
        this.username = username;
        this.email = email;
        this.note = note;
        this.token = token;
    }

    static async isAvailable(username: string) : Promise<boolean> {
        try {
            const existing = await database.query("SELECT * FROM accounts WHERE username = $1", [username]);
            if(existing.rows.length > 0) {
                return false;
            }
            const reserved = await database.query("SELECT * FROM account_requests WHERE username = $1", [username]);
            if(reserved.rows.length > 0) {
                return false;
            }
            return true;
        } catch (error) {
            console.error(error);
            return false;
        }
    }

    static async reserve(username: string, email: string, token: string, note: string) : Promise<AccountRequest> {
        try {
            const result = await database.query("INSERT INTO account_requests (token, username, email, created, note) VALUES ($1, $2, $3, NOW(), $4) RETURNING id", [token, username, email, note]);
            if(result.rows.length > 0) {
                const id = result.rows[0];
                return new AccountRequest(id, username, email, note, token);
            } else {
                throw new Error("Unable to reserve account in the database.")
            }
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async confirm(password : string) {
        try {
            const account = Account.register(this.username, password, this.email);
        } catch (error) {

        }
    }

    static async fromDatabase(token : string) : Promise<AccountRequest | null> {
        try {
            const result = await database.query("SELECT * FROM account_requests WHERE token = $1", [token]);
            if(result.rows.length > 0) {
                const entry = result.rows[0];
                const username = entry.username;
                const email = entry.email;
                const note = entry.note;
                const id = entry.id;
                return new AccountRequest(id, username, email, note, token);
            } else {
                return null;
            }
        } catch (error) {
            console.error(error);
            return null;
        }
    }
}