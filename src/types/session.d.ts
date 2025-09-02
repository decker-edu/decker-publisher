import Session from "express";

declare module "express-session" {
  interface SessionData {
    userId: number;
    CSRFToken: string;
  }
}
