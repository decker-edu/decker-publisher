import express from "express";
import "../types/express";
import { Account } from "../account";

export default async function (request: express.Request, response: express.Response, next: express.NextFunction) {
  if(request.session && request.session.userId) {
    const userId : number = request.session.userId;
    try {
      const account = await Account.fromDatabase(userId);
      request.account = account;
    } catch (error) {
      request.account = undefined;
    } finally {
      return next();
    }
  } else if (request.body.username && request.body.password) {
    try {
      const username : string = request.body.username;
      const password : string = request.body.password;
      const account : Account | null = await Account.fromDatabase(username);
      if(account) {
        const verified : boolean = await account.checkPassword(password);
        if(verified) {
          request.account = account;
        } else {
          request.account = undefined;
        }
      }
    } catch (error) {
      request.account = undefined;
    } finally {
      return next();
    }
  }
}