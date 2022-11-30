import database from "./database";

class AccountRequest {
    id: number;
    username: string;
    email: string;
    
    constructor(id: number, username: string, email: string) {
        this.id = id;
        this.username = username;
        this.email = email;
    }

    static async isAvailable(username: string) : Promise<boolean> {
        try {
            const existing = await database.query("SELECT * FROM accounts WHERE username = $1", [username]);
            if(existing.rows.length > 0) {
                return false;
            }
            const reserved = await database.query("SELECT * FROM account_requests WHERE username = $1", [username]);
            if(existing.rows.length > 0) {
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
            } else {
                throw new Error("Unable to reserve account in the database.")
            }
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
}