var pg = require("pg");
const config = require("./config.json");

process.env.PGUSER = config.pg_user;
process.env.PGHOST = config.pg_host;
process.env.PGPASSWORD = config.pg_pass;
process.env.PGDATABASE = config.pg_base;
process.env.PGPORT = config.pg_port;

var pool = undefined;

exports.setupPool = function () {
  if (pool) {
    return pool;
  }
  pool = new pg.Pool();
  console.log("[PG] New Pool created.");
  return pool;
};

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
