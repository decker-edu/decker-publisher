import database from "./database";

import session from "express-session";
import { SessionData } from "express-session";

const Store = session.Store;

function getExpiration(data : SessionData) {
  if (data && data.cookie && data.cookie["expires"]) {
    let expires = data.cookie["expires"];
    const date = new Date(
      typeof expires === "object" ? expires.valueOf() : expires
    );
    return Math.ceil(date.valueOf() / 1000);
  } else {
    const date = Date.now();
    return Math.ceil(date.valueOf() / 1000 + 86400 * 30);
  }
}

class CustomStore extends Store {
  async all(callback : (error : any, sessions: any[]) => void) {
    try {
      const result = await database.query("SELECT * FROM sessions");
      const sessions : any[] = [];
      for (const item of result.rows) {
        sessions.push(item.data);
      }
      callback(undefined, sessions);
    } catch (error) {
      callback(error, []);
    }
  }

  destroy(sid : string, callback : (error : any) => void) {
    const result = database.query("DELETE FROM sessions WHERE token = $1", [sid]).then((result) => {
      callback(undefined);
    }).catch((error) => {
      callback(error);
    });
  }

  async clear(callback : (error : any) => void) {
    try {
      await database.query("DELETE FROM sessions");
      callback(undefined);
    } catch (error) {
      callback(error);
    }
  }

  async length(callback: (error: any, length: number) => void) {
    try {
      const result = await database.query("SELECT COUNT(token) FROM sessions");
      callback(undefined, result.rows[0]);
    } catch (error) {
      callback(error, 0);
    }
  }

  get(sid : string, callback : (error : any, data: any) => void) {
    database.query("SELECT data FROM sessions WHERE token = $1", [sid])
      .then((result) => {
        if (result.rows.length > 0) {
          let data = result.rows[0].data;
          callback(
            undefined,
            typeof data === "string" ? JSON.parse(data) : data
          );
        } else {
          callback(undefined, undefined);
        }
      })
      .catch((error) => {
        callback(error, undefined);
      });
  }

  set(sid : string, data : SessionData, callback : (error : any) => void) {
    let expires = getExpiration(data);
    database.query(
      "INSERT INTO sessions (token, data, expires) SELECT $1, $2, TO_TIMESTAMP($3) ON CONFLICT (token) DO UPDATE SET token = $1, data = $2, expires = TO_TIMESTAMP($3) RETURNING token",
      [sid, data, expires]
    )
      .then((result) => {
        callback(undefined);
      })
      .catch((error) => {
        console.error(error);
        callback(error);
      });
  }

  touch(sid : string, data : SessionData, callback : () => void) {
    let expires = getExpiration(data);
    database.query(
      "UPDATE sessions SET expires = to_timestamp($1) WHERE token = $2",
      [expires, sid]
    )
      .then((result) => {
        callback();
      })
      .catch((error) => {
        console.error(error);
        callback();
      });
  }
}

const instance = new CustomStore();

export default instance;
