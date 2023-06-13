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
  } else if (request.body.username && request.body.password) {
    try {
      const username: string = request.body.username;
      const password: string = request.body.password;
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
