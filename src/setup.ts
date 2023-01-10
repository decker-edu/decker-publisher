import config from "../config.json"
import { Account } from "./backend/account";
import database from "./backend/database"
import Role from "./backend/role";

import { setup_feedback } from "./backend/routes/feedback";

import readline from "readline";

function exists(value : any) : boolean {
  if(!value || value === "") {
    return false;
  } else {
    return true;
  }
}

async function setup_database() {
  const accounts = await database.query(
    `CREATE TABLE IF NOT EXISTS accounts (
      id serial PRIMARY KEY NOT NULL,
      username VARCHAR(64) UNIQUE NOT NULL,
      hash VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      created TIMESTAMP NOT NULL
    )`
  );
  console.log(`[accounts] ${accounts.command} executed.`);
  const account_requests = await database.query(
    `CREATE TABLE IF NOT EXISTS account_requests (
      id serial PRIMARY KEY NOT NULL,
      token VARCHAR(128) UNIQUE NOT NULL,
      username VARCHAR(64) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      created TIMESTAMP NOT NULL,
      note TEXT
    )`
  );
  console.log(`[account_requests] ${account_requests.command} executed.`);
  const roles = await database.query(
    `CREATE TABLE IF NOT EXISTS roles (
      id serial PRIMARY KEY NOT NULL,
      name VARCHAR(64) UNIQUE NOT NULL
    )`
  );
  console.log(`[roles] ${roles.command} executed.`);
  const account_roles = await database.query(
    `CREATE TABLE IF NOT EXISTS account_roles (
      user_id integer NOT NULL,
      role_id integer NOT NULL,
      FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      CONSTRAINT unique_combination UNIQUE (user_id, role_id)
    )`
  );
  console.log(`[account_roles] ${account_roles.command} executed.`);
  const recovery_requests = await database.query(
    `CREATE TABLE IF NOT EXISTS recovery_requests (
      user_id integer NOT NULL UNIQUE,
      token VARCHAR NOT NULL,
      created TIMESTAMP NOT NULL,
      FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE
    )`
  );
  console.log(`[recovery_requests] ${recovery_requests.command} executed.`);
  const ssh_keys = await database.query(
    `CREATE TABLE IF NOT EXISTS ssh_keys (
      id serial NOT NULL PRIMARY KEY,
      username VARCHAR NOT NULL,
      key VARCHAR NOT NULL,
      FOREIGN KEY(username) REFERENCES accounts(username) ON DELETE CASCADE
    )`
  )
  console.log(`[ssh_keys] ${ssh_keys.command} executed.`);
  const sessions = await database.query(
    `CREATE TABLE IF NOT EXISTS sessions (
      token VARCHAR PRIMARY KEY NOT NULL,
      data JSON NOT NULL,
      expires TIMESTAMP NOT NULL
    )`
  );
  console.log(`[sessions] ${sessions.command} executed.`);

  try {
    const role : Role = await Role.create("admin");
    if(role) {
      console.log(`[admin role] created.`);
    } else {
      console.log("[admin role] already exists.")
    }
  } catch (error) {
    console.error(error);
  }

  const input = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let admin_username : string = config.setup_admin && config.setup_admin.username ? config.setup_admin.username : undefined;
  if(!admin_username) {
    console.log("[config.setup_admin.username] not specified. Please enter the admin username:");
    process.stdout.write("> ");
    const it = input[Symbol.asyncIterator]();
    const line = await it.next();
    admin_username = line.value;
  }
  let admin_password : string = config.setup_admin && config.setup_admin.password ? config.setup_admin.password : undefined;
  if(!admin_password) {
    console.log("[config.setup_admin.password] not specified. Please enter the admin password:");
    process.stdout.write("> ");
    const it = input[Symbol.asyncIterator]();
    const line = await it.next();
    admin_password = line.value;
  }
  let admin_email : string = config.setup_admin && config.setup_admin.email ? config.setup_admin.email : undefined;
  if(!admin_email) {
    console.log("[config.setup_admin.email] not specified. Please enter the admin email:");
    process.stdout.write("> ");
    const it = input[Symbol.asyncIterator]();
    const line = await it.next();
    admin_email = line.value;
  }

  if(exists(admin_username) && exists(admin_password) && exists(admin_email)) {
    try {
      const admin : Account | undefined = await Account.register(config.setup_admin.username, config.setup_admin.password, config.setup_admin.email);
      if(admin) {
        console.log(`[admin account] created`);
      } else {
        console.log(`[admin account] already exists.`)
      }
    } catch (error) {
      console.error(error);
    }
  }

  const role : Role = await Role.get("admin");
  const admin = await Account.fromDatabase(config.setup_admin.username);
  await admin.assignRole(role);
  
  input.close();
}

async function setup_legacy_feedback() {
  const feedback_accounts = await database.query(
    `CREATE TABLE IF NOT EXISTS feedback_accounts (
      id serial PRIMARY KEY NOT NULL,
      username VARCHAR(64) UNIQUE NOT NULL,
      hash VARCHAR NOT NULL,
      salt VARCHAR(16) NOT NULL,
      email VARCHAR(255) NOT NULL )`)
}

async function setup_amberscript() {
  const amberscript_charges = await database.query(
    `CREATE TABLE IF NOT EXISTS amberscript_charges (
      id serial PRIMARY KEY NOT NULL,
      user_id integer NOT NULL,
      seconds integer NOT NULL,
      caused_by integer NOT NULL,
      reason TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (caused_by) REFERENCES accounts(id) ON DELETE CASCADE
    )`
  );

  const amberscript_jobs = await database.query(
    `CREATE TABLE IF NOT EXISTS amberscript_jobs (
      jobId integer PRIMARY KEY UNIQUE NOT NULL,
      user_id integer NOT NULL,
      projectname VARCHAR(255) NOT NULL,
      relative_filepath VARCHAR NOT NULL,
      FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE
    )`
  );
}

(async () => {
  await setup_database();
  await setup_feedback();
  database.pool.end();
})()