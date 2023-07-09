import fs from "fs";
import path from "path";

import { createHash } from "crypto";

function traverseFilesystem(directory: string): string[] {
  const result: string[] = [];
  const names = fs.readdirSync(directory);
  for (const name of names) {
    const stat = fs.statSync(name);
    if (stat.isDirectory()) {
      const recursive = traverseFilesystem(name);
      for (const item of recursive) {
        result.push(item);
      }
    } else {
      result.push(name);
    }
  }
  return result;
}

export class Recording implements Recording {
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
      const files = await this.getFiles();
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

  async getFiles(): Promise<string[]> {
    return traverseFilesystem(this.directory);
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
    const target = path.join(this.directory, filename);
    const direcotry = path.dirname(target);
    if (!fs.existsSync(direcotry)) {
      fs.mkdirSync(direcotry, { recursive: true, mode: 0o0775 });
    }
    try {
      fs.promises.writeFile(target, content, "utf8");
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
