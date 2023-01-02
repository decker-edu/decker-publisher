import pg from "pg";
import config from "../../config.json";

const DATABASE_ERROR_MESSAGE : string = "Datenbankfehler";

export class DatabaseConfiguration {
    username: string;
    password: string;
    hostname: string;
    database: string;
    port: number;
}

export interface Query {
  query: string;
  values?: any[];
}

export class Transaction {
  queries : Query[];
  constructor() {
    this.queries = [];
  }

  add(query : Query) {
    this.queries.push(query);
  }

  async execute(client : pg.ClientBase) {
    try {
      await client.query("BEGIN");
      for(const query of this.queries) {
        if(query.values) {
          await client.query(query.query, query.values);
        } else {
          await client.query(query.query);
        }
      }
      await client.query("COMMIT");
    } catch (error) {
      console.error("[Transaction] Transaction failed. Executing ROLLBACK.");
      await client.query("ROLLBACK");
      throw error;
    }
  }
}

export class Database {
    pool: pg.Pool;
    constructor(config?: DatabaseConfiguration) {
      if(config) {
        this.pool = new pg.Pool({
          user: config.username,
          password: config.password,
          database: config.database,
          host: config.hostname,
          port: config.port
        })
      } else {
        this.pool = new pg.Pool();
      }
    }

    async execute(transaction : Transaction) : Promise<void> {
      try {
        const client : pg.PoolClient = await this.pool.connect();
        try {
          transaction.execute(client);
        } catch (error) {
          console.error("[DB] Transaction failed.");
          throw Error(DATABASE_ERROR_MESSAGE);
        } finally {
          client.release();
        }
      } catch (error) {
        console.error("[PG] Can not connect to pool.");
        throw Error(DATABASE_ERROR_MESSAGE);
      }
    }

    async query(query: string | Query, values? : any[]) : Promise<pg.QueryResult> {
      try {
        const client = await this.pool.connect();
        try {
          if(typeof query === "string") {
            if(values) {
              return client.query(query, values);
            } else {
              return client.query(query);
            }
          } else {
            if(query.values) {
              return client.query(query.query, query.values);
            } else {
              return client.query(query.query);
            }
          }
        } catch (error) {
          console.error("[DB] Error executing query:");
          console.error("[DB]", query);
          if(values) {
            console.error("[DB]", values);
          }
          throw Error(DATABASE_ERROR_MESSAGE);
        } finally {
          client.release();
        }
      } catch (error) {
        console.error("[PG] Can not connect to pool.");
        throw Error(DATABASE_ERROR_MESSAGE);
      }
    }
}

const configuration = new DatabaseConfiguration();
configuration.username = config.pg_user;
configuration.password = config.pg_pass;
configuration.database = config.pg_base;
configuration.hostname = config.pg_host;
configuration.port = config.pg_port;

const instance = new Database(configuration);

export default instance;
