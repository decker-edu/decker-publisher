declare interface IAccount {
  id: number;
  username: string;
  email: string;
  hash: string;
  roles?: string[];
  keys?: string[];
  checkPassword(password: string): Promise<boolean>;
  changePassword(password: string): Promise<void>;
  changeEmail(mail: string): Promise<void>;
  getKeys(): Promise<string[]>;
  setKeys(keys: string[]): Promise<void>;
  assignRole(role: IRole): Promise<void>;
  getDirectory(): string;
  getProjects(): IProject[];
  delete(): Promise<void>;
}

declare interface IRole {
  id: number;
  name: string;
}
