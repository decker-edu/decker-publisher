import { verify, hash } from "argon2";
import pg from "pg";
import database from "./database";
import { Transaction, Query } from "./database";
import config from "../../config.json";
import path from "path";
import fs from "fs";
import Role from "./role";
import { getAllFiles } from "../util";

const NO_RESULT_MESSAGE: string = "Kein Resultat";

type AccountCallback = (
  username: string,
  password: string,
  email: string
) => Promise<void>;

function getDirectories(parent: string): string[] {
  let result: string[] = [];
  if (!fs.existsSync(parent)) {
    return result;
  }
  const files = fs.readdirSync(parent);
  for (const file of files) {
    const filename = path.join(parent, file);
    const stat = fs.lstatSync(filename);
    if (stat.isDirectory()) {
      result.push(filename);
    }
  }
  return result;
}

export class Account implements Account {
  id: number;
  username: string;
  email: string;
  hash: string;
  roles?: string[];

  static registerHooks: AccountCallback[] = [];
  static passwordChangeHooks: AccountCallback[] = [];
  static emailChangeHooks: AccountCallback[] = [];

  constructor(
    id: number,
    username: string,
    email: string,
    hash: string,
    roles?: string[]
  ) {
    this.id = id;
    this.username = username;
    this.email = email;
    this.hash = hash;
    this.roles = roles;
  }

  static on(event: string, callback: AccountCallback) {
    switch (event) {
      case "registration":
        Account.registerHooks.push(callback);
        break;
      case "passwordChange":
        Account.passwordChangeHooks.push(callback);
        break;
      case "emailChange":
        Account.emailChangeHooks.push(callback);
        break;
      default:
        throw new Error("No such event");
    }
  }

  static async register(
    username: string,
    password: string,
    email: string
  ): Promise<Account | undefined> {
    try {
      const passwordHash = await hash(password);
      const result = await database.query(
        "INSERT INTO accounts(username, hash, email, created) VALUES ($1, $2, $3, NOW()) ON CONFLICT DO NOTHING RETURNING *",
        [username, passwordHash, email]
      );
      if (result.rows.length > 0) {
        console.log(
          "[accounts]",
          `${result.command} executed. ${result.rowCount}/${result.rows.length} rows affected.`
        );
        const data = result.rows[0];
        const account = new Account(
          data.id,
          data.username,
          data.email,
          data.hash,
          []
        );
        for (const hook of Account.registerHooks) {
          await hook(username, password, email);
        }
        return account;
      } else {
        console.log(
          "[accounts]",
          `conflict registering: ${username} with email: ${email}`
        );
        return undefined;
      }
    } catch (error) {
      console.error(error);
      throw new Error("Fehler beim Registrieren des Nutzers " + username);
    }
  }

  static async fromDatabase(source: number | string): Promise<Account | null> {
    if (typeof source === "number") {
      // Fetch by ID
      try {
        const result: pg.QueryResult = await database.query(
          "SELECT accounts.id as id, accounts.username as username, accounts.email as email, accounts.hash as hash, array(SELECT roles.name as name from roles JOIN account_roles ON roles.id = account_roles.role_id JOIN accounts ON accounts.id = account_roles.user_id WHERE accounts.id = $1) as roles FROM accounts WHERE id = $1",
          [source]
        );
        if (result.rows.length > 0) {
          const id: number = result.rows[0].id;
          const username: string = result.rows[0].username;
          const email: string = result.rows[0].email;
          const hash: string = result.rows[0].hash;
          const roles: string[] = result.rows[0].roles;
          return new Account(id, username, email, hash, roles);
        } else {
          return null;
        }
      } catch (error) {
        throw error;
      }
    } else {
      // Fetch by Username
      try {
        const result: pg.QueryResult = await database.query(
          "SELECT accounts.id as id, accounts.username as username, accounts.email as email, accounts.hash as hash, array(SELECT roles.name as name from roles JOIN account_roles ON roles.id = account_roles.role_id JOIN accounts ON accounts.id = account_roles.user_id WHERE accounts.username = $1) as roles FROM accounts WHERE username = $1",
          [source]
        );
        if (result.rows.length > 0) {
          const id: number = result.rows[0].id;
          const username: string = result.rows[0].username;
          const email: string = result.rows[0].email;
          const hash: string = result.rows[0].hash;
          const roles: string[] = result.rows[0].roles;
          return new Account(id, username, email, hash, roles);
        } else {
          return null;
        }
      } catch (error) {
        throw error;
      }
    }
  }

  async changePassword(password: string): Promise<void> {
    try {
      const passwordHash = await hash(password);
      const result = await database.query(
        "UPDATE accounts SET hash = $2 WHERE id = $1 RETURNING id",
        [this.id, passwordHash]
      );
      if (result && result.rows.length > 0) {
        for (const hook of Account.passwordChangeHooks) {
          await hook(this.username, password, this.email);
        }
      } else {
        throw new Error("Passwortaktuallisierung ergab kein Resultat.");
      }
    } catch (error) {
      console.error(error);
      throw new Error("Passwort konnte nicht geändert werden.");
    }
  }

  async changeEmail(email: string): Promise<void> {
    try {
      const result = await database.query(
        "UPDATE accounts SET email = $2 WHERE id = $1 RETURNING id",
        [this.id, email]
      );
      if (result && result.rows.length > 0) {
        for (const hook of Account.emailChangeHooks) {
          hook(this.username, undefined, this.email);
        }
      } else {
        throw new Error("E-Mail-Aktuallisierung ergab kein Resultat.");
      }
    } catch (error) {
      console.error(error);
      throw new Error("Passwort konnte nicht geändert werden.");
    }
  }

  async checkPassword(password: string): Promise<boolean> {
    return verify(this.hash, password);
  }

  async getKeys(): Promise<string[]> {
    try {
      const result = await database.query(
        "SELECT key FROM ssh_keys JOIN accounts ON ssh_keys.username = accounts.username WHERE accounts.id = $1",
        [this.id]
      );
      let ret: string[] = [];
      for (const item of result.rows) {
        ret.push(item.key);
      }
      return ret;
    } catch (error) {
      return [];
    }
  }

  async setKeys(keys: string[]): Promise<void> {
    const transaction = new Transaction();
    transaction.add({
      query: "DELETE FROM ssh_keys WHERE username = $1",
      values: [this.username],
    });
    for (const key of keys) {
      transaction.add({
        query: "INSERT INTO ssh_keys (username, key) VALUES ($1, $2)",
        values: [this.username, key],
      });
    }
    await database.execute(transaction);
  }

  async assignRole(role: Role): Promise<void> {
    const query = await database.query(
      "INSERT INTO account_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [this.id, role.id]
    );
    if (query && query.rowCount > 0) {
      console.log(
        "[account_roles]",
        `${query.command} executed. Assigned ${this.username} the role ${role.name}.`
      );
    } else {
      console.log(
        "[account_roles]",
        `${query.command} affected nothing. Role ${role.name} was already assigned to ${this.username}.`
      );
    }
  }

  getDirectory(): string {
    if (config.user_directory_name.startsWith("/")) {
      return path.join(config.user_directory_name, this.username);
    } else {
      return path.join(
        global.rootDirectory,
        config.user_directory_name,
        this.username
      );
    }
  }

  getProjects(): Project[] {
    const dir: string = this.getDirectory();
    const projectDir: string = path.join(dir, "projects");
    const directories: string[] = getDirectories(projectDir);
    const projects: Project[] = [];
    for (const directory of directories) {
      const mp4s = getAllFiles(directory, (file) => {
        const ext = path.extname(file);
        const name = path.basename(file, ext);
        return ext === ".mp4" && name.endsWith("recording");
      });
      const videoData: VideoLinkData[] = mp4s.map((video) => {
        return {
          filename: path.basename(video),
          filepath: path.relative(directory, video),
        };
      });
      projects.push({
        name: path.basename(directory),
        directory: directory,
        videos: videoData,
      });
    }
    return projects;
  }
}
