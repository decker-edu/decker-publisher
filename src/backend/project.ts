import fs from "fs";
import path from "path";

import { createHash } from "crypto";

export class Recording {
  project: Project;
  relativePath: string;

  constructor(project: Project, relativePath: string) {
    this.project = project;
    this.relativePath = relativePath;
  }

  getProject(): Project {
    return this.project;
  }

  getAbsolutePath(): string {
    return path.join(this.project.getDirectory(), this.relativePath);
  }

  getRelativePath(): string {
    return this.relativePath;
  }
}

export default class Project implements Project {
  name: string;
  directory: string;
  videos: VideoLinkData[];
  owner: Account;

  getDirectory(): string {
    return this.directory;
  }

  async getRecordings(): Promise<Recording[]> {
    try {
      const files = await fs.promises.readdir(this.directory);
      let result: Recording[] = [];
      for (const file of files) {
        if (file.endsWith(".webm") && file.includes(this.name)) {
          result.push(new Recording(this, file));
        }
      }
      return result;
    } catch (error) {
      throw error;
    }
  }

  constructor(owner: Account, name: string) {
    const ownerDirectory = owner.getDirectory();
    this.directory = path.join(ownerDirectory, "projects", name);
    this.name = name;
    this.owner = owner;
  }

  async fileExists(filename: string): Promise<boolean> {
    return fs.existsSync(path.join(this.directory, filename));
  }

  async readFile(filename: string): Promise<string> {
    return fs.promises.readFile(path.join(this.directory, filename), "utf8");
  }

  async writeFile(
    filename: string,
    content: string | Buffer
  ): Promise<boolean> {
    try {
      fs.promises.writeFile(
        path.join(this.directory, filename),
        content,
        "utf8"
      );
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  async getFileHash(filename: string): Promise<string> {
    const content = await this.readFile(filename);
    const hash = createHash("sha256").update(content).digest("hex");
    return hash;
  }
}
