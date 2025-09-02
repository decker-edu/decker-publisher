import express from "express";

import fs from "fs";
import path from "path";
import { createHash } from "crypto";

export function isSet(value: any): boolean {
  if (!value || value === "") {
    return false;
  } else {
    return true;
  }
}

export function requireLogin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (!req.account) {
    res.redirect("/");
  } else {
    next();
  }
}

function forbidden(res: express.Response, message: string) {
  return res.status(403).json({ message: message }).end();
}

export function csrf() {
  return function (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    const csrf = req.headers["x-csrf-token"];
    if (isSet(csrf)) {
      const token = req.session.CSRFToken;
      if (csrf !== token) {
        return forbidden(res, "Invalid CSRF Token");
      }
      next();
    } else {
      return forbidden(res, "Invalid CSRF Token");
    }
  };
}

export function createCSRFToken(): string {
  return createHash("sha1").update(randomString(32)).digest("base64");
}

export async function retrieveKeys(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  req.account.keys = await req.account.getKeys();
  next();
}

export function randomString(length: number, characters?: string) {
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

export function getAllFiles(
  directory: string,
  filter: (arg: string) => boolean
): string[] {
  let result: string[] = [];
  if (!fs.existsSync(directory)) {
    return [];
  }
  const files = fs.readdirSync(directory);
  for (let file of files) {
    let filename = path.join(directory, file);
    const stat = fs.statSync(filename);
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
