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

export class Recording implements IRecording {
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

export default class Project implements IProject {
  name: string;
  directory: string;
  videos: IVideoLinkData[];
  owner: IAccount;

  constructor(owner: IAccount, name: string) {
    const ownerDirectory = owner.getDirectory();
    this.directory = path.join(ownerDirectory, "projects", name);
    this.name = name;
    this.owner = owner;
  }

  getDirectory(): string {
    return this.directory;
  }

  async getRecordings(): Promise<IRecording[]> {
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

  async getFiles(): Promise<string[]> {
    return traverseFilesystem(this.directory);
  }

  async fileExists(filename: string): Promise<boolean> {
    return fs.existsSync(path.join(this.directory, filename));
  }

  async readFile(filename: string): Promise<string> {
    return fs.promises.readFile(path.join(this.directory, filename), "utf8");
  }

  maybeDeleteDirectory(directory: string) {
    if (directory === this.directory) {
      return;
    }
    const files = fs.readdirSync(directory);
    if (files.length === 0) {
      fs.rmdirSync(directory);
      this.maybeDeleteDirectory(path.dirname(directory));
    }
  }

  async deleteFile(filename: string): Promise<boolean> {
    const target = path.join(this.directory, filename);
    const directory = path.dirname(target);
    if (fs.existsSync(target)) {
      fs.rmSync(target);
    } else {
      return false;
    }
    try {
      this.maybeDeleteDirectory(directory);
      return true;
    } catch (error) {
      return false;
    }
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
