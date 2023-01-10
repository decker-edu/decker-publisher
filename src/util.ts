import fs from "fs";
import path from "path";

export function randomString(length : number, characters? : string) {
    let result = "";
    let options = characters
      ? characters
      : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let amount = options.length;
    for (let i = 0; i < length; i++) {
      result += options.charAt(Math.floor(Math.random() * amount));
    }
    return result;
}

export function getAllFiles(directory: string, filter: (arg: string) => boolean) : string[] {
  let result : string[] = [];
  if (!fs.existsSync(directory)) {
    return [];
  }
  const files = fs.readdirSync(directory);
  for (let file of files) {
    const filename = path.join(directory, file);
    const stat = fs.lstatSync(filename);
    if (stat.isDirectory()) {
      const recusion = getAllFiles(filename, filter);
      result = result.concat(recusion);
    } else {
      if (!filter || filter(file)) {
        result.push(filename);
      }
    }
  }
  return result;
}