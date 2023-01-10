import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from "@jest/globals"
import { Database, DatabaseConfiguration } from "../src/backend/database"

import config from "./test.config.json"

describe("Testing Database Configuration", () => {
    const configuration = new DatabaseConfiguration();
    configuration.database = config.database.database;
    configuration.username = config.database.username;
    configuration.password = config.database.password;
    configuration.hostname = config.database.hostname;
    configuration.port = config.database.port;

    const pg_configuration = new DatabaseConfiguration();
    pg_configuration.database = "postgres";
    pg_configuration.username = config.database.username;
    pg_configuration.password = config.database.password;
    pg_configuration.hostname = config.database.hostname;
    pg_configuration.port = config.database.port;

    let database : Database;

    /* CREATE DATABASE and DROP DATABASE statements can not be prepared and need to be hardcoded.
     * This allows for SQL-injection through the config file but as YOU dear reader are responsible for it's
     * contents this should not be an issue. */
    async function createTestDatabase(db_config : DatabaseConfiguration) {
        const pg_database : Database = new Database(db_config);
        const query = await pg_database.query(
            `CREATE DATABASE "${configuration.database}" WITH
                OWNER = "${configuration.username}"
                ENCODING = 'UTF8'
                CONNECTION LIMIT = -1
            `);
        await pg_database.disconnect();
    }

    async function dropTestDatabase(db_config : DatabaseConfiguration) {
        const pg_database : Database = new Database(db_config);
        const query = await pg_database.query(`DROP DATABASE IF EXISTS "${configuration.database}"`);
        await pg_database.disconnect();
    }

    beforeAll(async () => {
        return createTestDatabase(pg_configuration);
    })

    beforeEach(async () => {
        database = new Database(configuration);
    })

    afterEach(async () => {
        await database.disconnect();
    })

    afterAll(async () => {
        await dropTestDatabase(pg_configuration);
    })

    test("Database Connection", async () => {
        const now = (await database.query("SELECT NOW()")).rows[0];
        expect(now).toBeDefined();
    })

    test("Database Setup", async () => {
        
    })
})