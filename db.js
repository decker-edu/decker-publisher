var pg = require("pg");
const config = require("./config.json");
const Account = require("./types/account");
const { DB_ERROR, USER_NOT_FOUND } = require("./types/errors");

process.env.PGUSER = config.pg_user;
process.env.PGHOST = config.pg_host;
process.env.PGPASSWORD = config.pg_pass;
process.env.PGDATABASE = config.pg_base;
process.env.PGPORT = config.pg_port;

let pool = undefined;

function setupPool() {
  if (pool) {
    return pool;
  }
  pool = new pg.Pool();
  console.log("[PG] New Pool created.");
  return pool;
}

exports.setupPool = setupPool;

exports.transact = function (query, values) {
  return new Promise((resolve, reject) => {
    if (!pool) {
      setupPool();
    }
    pool.connect(async (err, client, release) => {
      function maybeRollback(error) {
        if (error) {
          console.error("[DB] Transaction error. ", error.stack);
          client.query("ROLLBACK", (rollback_error) => {
            if (rollback_error) {
              console.error("[DB] Rollback failed. ", rollback_error.stack);
            }
            release();
          });
        }
        return !!error;
      }

      if (err) {
        return console.error("[DB] Can not connect to pool. ", err.stack);
      }

      client.query("BEGIN", (error, result) => {
        if (maybeRollback(error)) return reject(error);
        client.query(query, values, (error, actual_result) => {
          if (maybeRollback(error)) return reject(error);
          client.query("COMMIT", (error, result) => {
            if (error) {
              console.error("[DB] Error commiting transaction. ", error.stack);
            }
            release();
            resolve(actual_result);
          });
        });
      });
    });
  });
};

exports.getAccountByID = function (id) {
  if (!pool) setupPool();
  return new Promise((resolve, reject) => {
    pool
      .query("SELECT id, username, hash, email FROM accounts WHERE id = $1", [
        id,
      ])
      .then((result) => {
        if (result) {
          if (result.rows.length > 0) {
            const data = result.rows[0];
            resolve(new Account(data.id, data.username, data.email, data.hash));
          } else {
            reject(USER_NOT_FOUND);
          }
        } else {
          reject(DB_ERROR);
        }
      })
      .catch((error) => {
        reject(error);
      });
  });
};

exports.getAccountByName = function (username) {
  if (!pool) setupPool();
  return new Promise((resolve, reject) => {
    pool
      .query(
        "SELECT id, username, hash, email FROM accounts WHERE username = $1",
        [username]
      )
      .then((result) => {
        if (result) {
          if (result.rows.length > 0) {
            const data = result.rows[0];
            resolve(new Account(data.id, data.username, data.email, data.hash));
          } else {
            reject(USER_NOT_FOUND);
          }
        } else {
          reject(DB_ERROR);
        }
      })
      .catch((error) => {
        reject(error);
      });
  });
};

exports.deleteAccount = function (account) {
  if (!pool) setupPool();
  return new Promise((resolve, reject) => {
    const deleteRoles = pool.query(
      "DELETE FROM account_roles WHERE user_id = $1",
      [account.username]
    );
    const p1 = pool.query("DELETE FROM accounts WHERE username = $1", [
      account.username,
    ]);
    const p2 = pool.query("DELETE FROM feedback_accounts WHERE username = $1", [
      account.username,
    ]);
    Promise.all([p1, p2])
      .then(([result1, result2]) => {})
      .catch((error) => {
        reject(error);
      });
  });
};
