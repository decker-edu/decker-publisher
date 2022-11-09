declare interface Account {
    id: number;
    username: string;
    hash: string;
    roles?: string[];
    keys?: string[];
    getKeys() : Promise<string[]>;
    getDirectory() : string;
    getProjects() : Project[];
}