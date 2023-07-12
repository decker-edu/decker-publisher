declare interface IProject {
  name: string;
  directory: string;
  videos: IVideoLinkData[];
  getRecordings(): Promise<IRecording[]>;
  getFiles(): Promise<string[]>;
  fileExists(filename: string): Promise<boolean>;
  readFile(filename: string): Promise<string>;
  writeFile(filename: string, content: string | Buffer): Promise<boolean>;
  deleteFile(filename: string): Promise<boolean>;
  getFileHash(filename: string): Promise<string>;
}

declare interface IRecording {
  project: IProject;
  relativePath: string;
  getProject(): IProject;
  getAbsolutePath(): string;
  getRelativePath(): string;
}

declare interface IVideoLinkData {
  filename: string;
  filepath: string;
}
