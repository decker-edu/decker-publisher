import express from "express";
import { Account } from "../account";

export default async function (
  request: express.Request,
  response: express.Response,
  next: express.NextFunction
) {
  if (request.session && request.session.userId) {
    const userId: number = request.session.userId;
    try {
      const account = await Account.fromDatabase(userId);
      request.account = account;
      response.locals.account = account;
    } catch (error) {
      request.account = undefined;
      response.locals.account = undefined;
    } finally {
      return next();
    }
  } else if (request.headers.authorization) {
    try {
      const header = request.headers.authorization;
      if (!header.startsWith("Basic")) {
        request.account = undefined;
        response.locals.account = undefined;
        return next();
      }
      const encoded = header.split(" ")[1];
      const decoded = Buffer.from(encoded, "base64").toString("utf-8");
      const colon = decoded.indexOf(":");
      const username: string = decoded.substring(0, colon);
      const password: string = decoded.substring(colon + 1);
      const account: Account | null = await Account.fromDatabase(username);
      if (account) {
        const verified: boolean = await account.checkPassword(password);
        if (verified) {
          request.account = account;
          response.locals.account = account;
        } else {
          request.account = undefined;
          response.locals.account = undefined;
        }
      } else {
        request.account = undefined;
        response.locals.account = undefined;
      }
    } catch (error) {
      console.error(error);
      request.account = undefined;
      response.locals.account = undefined;
    } finally {
      return next();
    }
  }
  return next();
}
