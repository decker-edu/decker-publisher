const db = require("./db.js");
const cache = require("./cache.js");
const config = require("./config.json");

let pool = db.setupPool();

let acc_promise = pool
  .query(
    "CREATE TABLE IF NOT EXISTS accounts (id serial PRIMARY KEY NOT NULL, username VARCHAR(64) UNIQUE NOT NULL, hash VARCHAR(255) NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, created TIMESTAMP NOT NULL)"
  )
  .then((result) => {
    console.log(
      "[accounts] created.",
      `${result.command} executed. ${result.rowCount} rows affected.`
    );
  });

let req_promise = pool
  .query(
    "CREATE TABLE IF NOT EXISTS account_requests (id serial PRIMARY KEY NOT NULL, token VARCHAR(128) UNIQUE NOT NULL, username VARCHAR(64) UNIQUE NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, created TIMESTAMP NOT NULL, note TEXT)"
  )
  .then((result) => {
    console.log(
      "[account_requests] created.",
      `${result.command} executed. ${result.rowCount} rows affected.`
    );
  });

let fdb_promise = pool
  .query(
    "CREATE TABLE IF NOT EXISTS feedback_accounts (id serial PRIMARY KEY NOT NULL, username VARCHAR(64) UNIQUE NOT NULL, hash VARCHAR NOT NULL, salt VARCHAR(16) NOT NULL, email VARCHAR(255) NOT NULL)"
  )
  .then((result) => {
    console.log(
      "[feedback_accounts] created.",
      `${result.command} executed. ${result.rowCount} rows affected.`
    );
  });

let rol_promise = pool
  .query(
    "CREATE TABLE IF NOT EXISTS roles (id serial PRIMARY KEY NOT NULL, name VARCHAR(64) UNIQUE NOT NULL)"
  )
  .then((result) => {
    console.log(
      "[roles] created.",
      `${result.command} executed. ${result.rowCount} rows affected.`
    );
  });

let ses_promise = pool
  .query(
    "CREATE TABLE IF NOT EXISTS sessions (token VARCHAR PRIMARY KEY NOT NULL, data JSON NOT NULL, expires TIMESTAMP NOT NULL)"
  )
  .then((result) => {
    console.log(
      "[amberscript_charges] created.",
      `${result.command} executed. ${result.rowCount} rows affected.`
    );
  });

let all_promise = Promise.all([
  acc_promise,
  req_promise,
  fdb_promise,
  rol_promise,
  ses_promise,
]).then((results) => {
  let ar_promise = pool
    .query(
      "CREATE TABLE IF NOT EXISTS account_roles (user_id integer NOT NULL, role_id integer NOT NULL, FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE, FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE, CONSTRAINT unique_combination UNIQUE (user_id, role_id))"
    )
    .then((result) => {
      console.log(
        "[account_roles] created.",
        `${result.command} executed. ${result.rowCount} rows affected.`
      );
    });

  let rec_promise = pool
    .query(
      "CREATE TABLE IF NOT EXISTS recovery_requests (user_id integer NOT NULL UNIQUE, token VARCHAR NOT NULL, created TIMESTAMP NOT NULL, FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE)"
    )
    .then((result) => {
      console.log(
        "[recovery_requests] created.",
        `${result.command} executed. ${result.rowCount} rows affected.`
      );
    });

  let am_promise = pool
    .query(
      "CREATE TABLE IF NOT EXISTS amberscript_charges (id serial PRIMARY KEY NOT NULL, user_id integer NOT NULL, seconds integer NOT NULL, caused_by integer NOT NULL, reason TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES accounts(id), FOREIGN KEY (caused_by) REFERENCES accounts(id))"
    )
    .then((result) => {
      console.log(
        "[amberscript_charges] created.",
        `${result.command} executed. ${result.rowCount} rows affected.`
      );
    });

  let keys_promise = pool
    .query(
      "CREATE TABLE IF NOT EXISTS ssh_keys (username VARCHAR NOT NULL UNIQUE PRIMARY KEY, key VARCHAR NOT NULL, FOREIGN KEY(username) REFERENCES accounts(username) ON DELETE CASCADE)"
    )
    .then((result) => {
      console.log(
        "[ssh_keys] created.",
        `${result.command} executed. ${result.rowCount} rows affected.`
      );
    });

  let jo_promise = pool
    .query(
      "CREATE TABLE IF NOT EXISTS amberscript_jobs (jobId integer PRIMARY KEY UNIQUE NOT NULL, user_id integer NOT NULL, projectname VARCHAR(255) NOT NULL, relative_filepath VARCHAR NOT NULL, FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE)"
    )
    .then((result) => {
      console.log(
        "[amberscript_jobs] created.",
        `${result.command} executed. ${result.rowCount} rows affected.`
      );
    });

  /*
  let pr_promise = pool
    .query(
      "CREATE TABLE IF NOT EXISTS project_allowance (user_id integer NOT NULL, allowed_amount integer NOT NULL, FOREIGN KEY (user_id) REFERENCES accounts(id))"
    )
    .then((result) => {
      console.log(
        "[project_allowance] created.",
        `${result.command} executed. ${result.rowCount} rows affected.`
      );
    });
  */

  Promise.all([ar_promise, am_promise, rec_promise, jo_promise]).then(
    (results) => {
      cache
        .createAccount(
          config.setup_admin.username,
          config.setup_admin.password,
          config.setup_admin.email
        )
        .then((result) => {
          console.log("[create admin account]", result);
          pool
            .query(
              "INSERT INTO roles (name) VALUES ('admin') ON CONFLICT DO NOTHING"
            )
            .then((result) => {
              console.log(
                "[create admin role]",
                `${result.command} executed. ${result.rowCount} rows affected.`
              );
              pool
                .query(
                  "INSERT INTO account_roles VALUES (1, 1) ON CONFLICT DO NOTHING"
                )
                .then((result) => {
                  console.log(
                    "[assign admin role]",
                    `${result.command} executed. ${result.rowCount} rows affected.`
                  );
                });
            });
        });
    }
  );
});
