const db = require("./db");

const session = require("express-session");

const Store = session.Store;

function getExpiration(data) {
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
  async all(callback) {
    try {
      let result = await db.transact("SELECT * FROM sessions");
      let sessions = [];
      for (item of result.rows) {
        sessions.push(item.data);
      }
    } catch (error) {
      callback(error, undefined);
    }
  }

  destroy(sid, callback) {
    db.transact("DELETE FROM sessions WHERE token = $1", [sid])
      .then((result) => {
        callback(undefined);
      })
      .catch((error) => {
        callback(error);
      });
  }

  async clear(callback) {
    try {
      await db.transact("DELETE FROM sessions");
      callback(undefined);
    } catch (error) {
      callback(error);
    }
  }

  async length(callback) {
    try {
      let result = await db.transact("SELECT COUNT(token) FROM sessions");
      callback(undefined, result.rows[0]);
    } catch (error) {
      callback(error, undefined);
    }
  }

  get(sid, callback) {
    db.transact("SELECT data FROM sessions WHERE token = $1", [sid])
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

  set(sid, data, callback) {
    let expires = getExpiration(data);
    db.transact(
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

  touch(sid, data, callback) {
    let expires = getExpiration(data);
    db.transact(
      "UPDATE sessions SET expires = to_timestamp($1) WHERE token = $2",
      [expires, sid]
    )
      .then((result) => {
        callback(undefined);
      })
      .catch((error) => {
        callback(error);
      });
  }
}

const instance = new CustomStore();

module.exports = instance;
