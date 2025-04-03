import express from "express";
const router = express.Router();
import escapeHTML from "escape-html";

import database from "../../backend/database";

router.get(
  "/",
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const account = req.account;
    if (!account) {
      return res.render("error", { message: "Nicht authentifiziert." });
    }
    if (account.roles.includes("admin")) {
      return res.render("admin", {
        title: "Administration",
        user: account,
        admin: true,
      });
    } else {
      return res.render("error", {
        error: { status: 403 },
        message: "Not authenticated.",
      });
    }
  }
);

router.get(
  "/users",
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const account = req.account;
    if (!account) {
      return res.render("error", {
        error: { status: 403 },
        message: "Nicht authentifiziert.",
      });
    }
    if (account.roles.includes("admin")) {
      const accounts = await database.query(
        "SELECT id, username, email FROM accounts ORDER BY id"
      );
      return res.render("admin-users", {
        title: "Benutzeradministration",
        user: account,
        admin: true,
        accounts: accounts.rows,
      });
    } else {
      return res.render("error", {
        error: { error: { status: 403 }, message: "Not authenticated." },
      });
    }
  }
);

router.get(
  "/requests",
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const account = req.account;
    if (!account) {
      return res.render("error", {
        error: { message: "Nicht authentifiziert." },
      });
    }
    if (account.roles.includes("admin")) {
      const requests = await database.query(
        "SELECT id, username, email, token, note, created FROM account_requests"
      );
      return res.render("admin-requests", {
        title: "Anfrageadministration",
        user: req.account,
        admin: true,
        requests: requests.rows,
      });
    } else {
      return res.render("error", {
        error: { error: { status: 403 }, message: "Not authenticated." },
      });
    }
  }
);

export default router;
