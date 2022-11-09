import { verify } from "argon2";
import pg from "pg";
import database from "./database";
import config from "config.json";
import path from "path";
import fs from "fs";

const NO_RESULT_MESSAGE : string = "Kein Resultat";

function getFiles(directory: string, filter: (arg: string) => boolean) : string[] {
    let result : string[] = [];
    if (!fs.existsSync(directory)) {
      return [];
    }
    const files = fs.readdirSync(directory);
    for (let file of files) {
      const filename = path.join(directory, file);
      const stat = fs.lstatSync(filename);
      if (stat.isDirectory()) {
        const recusion = getFiles(filename, filter);
        result = result.concat(recusion);
      } else {
        if (!filter || filter(file)) {
          result.push(filename);
        }
      }
    }
    return result;
}

function getDirectories(parent : string) : string[] {
    let result : string[] = [];
    if(!fs.existsSync(parent)) {
        return result;
    }
    const files = fs.readdirSync(parent);
    for(const file of files) {
        const filename = path.join(parent, file);
        const stat = fs.lstatSync(filename);
        if(stat.isDirectory()) {
            result.push(filename);
        }
    }
    return result;
}

export class Account {
    id: number;
    username: string;
    hash: string;
    roles?: string[];

    constructor(id: number, username: string, hash: string, roles?: string[]) {
        this.id = id;
        this.username = username;
        this.hash = hash;
        this.roles = roles;
    }

    static async fromDatabase(source : number | string) : Promise<Account | null> {
        if(typeof source === "number") {
            try {
                const result : pg.QueryResult = await database.query("SELECT accounts.id as id, accounts.username as username, accounts.hash as hash, array(SELECT roles.name as name from roles JOIN account_roles ON roles.id = account_roles.role_id JOIN accounts ON accounts.id = account_roles.user_id WHERE accounts.id = $1) as roles FROM accounts WHERE id = $1", [source]);
                if(result.rows.length > 0) {
                    const id : number = result.rows[0].id;
                    const username : string = result.rows[0].username;
                    const hash : string = result.rows[0].hash;
                    const roles : string[] = result.rows[0].roles;
                    return new Account(id, username, hash, roles);
                } else {
                    return null;
                }
            } catch (error) {
                throw error;
            }
        } else {
            try {
                const result : pg.QueryResult = await database.query("SELECT accounts.id as id, accounts.username as username, accounts.hash as hash, array(SELECT roles.name as name from roles JOIN account_roles ON roles.id = account_roles.role_id JOIN accounts ON accounts.id = account_roles.user_id WHERE accounts.username = $1) as roles FROM accounts WHERE username = $1", [source]);
                if(result.rows.length > 0) {
                    const id : number = result.rows[0].id;
                    const username : string = result.rows[0].username;
                    const hash : string = result.rows[0].hash;
                    const roles : string[] = result.rows[0].roles;
                    return new Account(id, username, hash, roles);
                } else {
                    return null;
                }
            } catch (error) {
                throw error;
            }
        }
    }
    
    async checkPassword(password : string) : Promise<boolean> {
        return verify(this.hash, password);
    }

    async getKeys() : Promise<string[]> {
        try {
            const result = await database.query("SELECT key FROM ssh_keys JOIN accounts ON ssh_keys.username = accounts.username WHERE accounts.id = $1", [this.id]);
            let ret : string[] = [];
            for(const item of result.rows) {
                ret.push(item.key);
            }
            return ret;
        } catch (error) {
            return [];
        }
    }

    getDirectory() : string {
        if(config.user_directory_name.startsWith("/")) {
            return path.join(config.user_directory_name, this.username);
        } else {
            return path.join(
              global.rootDirectory,
              config.user_directory_name,
              this.username
            );
        }
    }

    getProjects() : Project[] {
        const dir : string = this.getDirectory();
        const projectDir : string = path.join(dir, "projects");
        const directories : string[] = getDirectories(projectDir);
        const projects : Project[] = [];
        for(const directory of directories) {
            const mp4s = getFiles(directory, (file) => {
                const ext = path.extname(file);
                return ext === ".mp4";
            });
            const videoData : VideoLinkData[] = mp4s.map((video) => {
                return {
                    filename: path.basename(video),
                    filepath: path.relative(directory, video)
                };
            });
            projects.push({name: path.basename(directory), directory: directory, videos: videoData})
        }
        return projects;
    }
}