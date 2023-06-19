import fs from "fs";

interface Config {
  session_secret: string;
  database: {
    pg_user: string;
    pg_pass: string;
    pg_base: string;
    pg_host: string;
    pg_port: number;
  };
  feedback_db_file: string;
  user_directory_name: string;
  amberscriptCallbackUrl: string;
  amberscriptAPIKey: string;
  setup_admin: {
    username: string;
    password: string;
    email: string;
  };
  mail_config: {
    mail_from: string;
    mail_program: string;
  };
  hostname: string;
}

let config: Config | undefined = undefined;

export default function getConfig(): Config {
  if (!config) {
    config = loadJSON();
  }
  return config;
}

function loadJSON(): Config {
  const content = fs.readFileSync("./config.json", "utf-8");
  return JSON.parse(content);
}
