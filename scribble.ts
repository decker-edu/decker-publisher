import { Database, DatabaseConfiguration } from "./src/backend/database";

import config from "./tests/test.config.json"

const pg_configuration = new DatabaseConfiguration();
pg_configuration.database = "postgres";
pg_configuration.username = config.database.username;
pg_configuration.password = config.database.password;
pg_configuration.hostname = config.database.hostname;
pg_configuration.port = config.database.port;

try {
    const database = new Database(pg_configuration);
    database.query("SELECT NOW()").then(result => {
        console.table(result.rows);
    }).then(() => {
        database.query(`CREATE DATABASE '${config.database.database}' WITH
        OWNER = '${config.database.username}'
        ENCODING = 'UTF8'
        CONNECTION LIMIT = -1`,).then(result => console.table(result)).then(() => database.disconnect());
    }).catch(error => console.table(error));
} catch(error) {
    console.table(error);
}