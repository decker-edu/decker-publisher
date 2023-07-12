import database from "./database";

export default class Role implements IRole {
  id: number;
  name: string;

  constructor(id: number, name: string) {
    this.id = id;
    this.name = name;
  }

  static async create(name: string): Promise<Role | undefined> {
    const role = await database.query(
      `INSERT INTO roles (name) VALUES ($1) ON CONFLICT DO NOTHING RETURNING *`,
      [name]
    );
    if (role && role.rows.length > 0) {
      console.log("[roles]", `${role.command} executed.`);
      const data = role.rows[0];
      return new Role(data.id, data.name);
    } else {
      console.log("[roles]", `conflict creating role ${name}.`);
      return undefined;
    }
  }

  static async get(name: string): Promise<Role | undefined> {
    const role = await database.query(
      `SELECT id, name FROM roles WHERE name = $1`,
      [name]
    );
    if (role && role.rows.length > 0) {
      const data = role.rows[0];
      return new Role(data.id, data.name);
    } else {
      return undefined;
    }
  }
}
