declare interface Project {
  name: string;
  directory: string;
  videos: VideoLinkData[];
  getRecordings(): Promise<Recording[]>;
  getFiles(): Promise<string[]>;
  fileExists(filename: string): Promise<boolean>;
  readFile(filename: string): Promise<string>;
  writeFile(filename: string, content: string | Buffer): Promise<boolean>;
  getFileHash(filename: string): Promise<string>;
}

declare interface Recording {
  project: Project;
  relativePath: string;
  getProject(): Project;
  getAbsolutePath(): string;
  getRelativePath(): string;
}

declare interface VideoLinkData {
  filename: string;
  filepath: string;
}
