import express from "express";
const router = express.Router();

import escapeHTML from "escape-html";

import validator from "email-validator";
import fs from "fs";
import path from "path";

import database from "../../database";

import { Account } from "../../account";

function verifyEmail(mail: string, allowedOrigins: string[]) {
  let format = validator.validate(mail);
  let origin = true;
  if (allowedOrigins) {
    origin = false;
    for (let suffix of allowedOrigins) {
      if (mail.endsWith(suffix)) {
        origin = true;
        break;
      }
    }
  }
  return { format: format, origin: origin };
}

function isSet(value: any): boolean {
  if (!value || value === "") {
    return false;
  } else {
    return true;
  }
}

function requireBody(name: string) {
  return function (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    const field = req.body[name];
    if (isSet(field)) {
      next();
    } else {
      res
        .status(400)
        .json({ message: escapeHTML("Fehlerhafte Anfrage.") })
        .end();
    }
  };
}

router.post(
  "/reset-password",
  requireBody("email"),
  requireBody("newPassword"),
  requireBody("token"),
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const email = req.body.email;
    const password = req.body.newPassword;
    const token = req.body.token;
    if (password.length < 8) {
      return res
        .status(400)
        .json({
          message: escapeHTML(
            "Das Passwort muss aus mindestens 8 Zeichen bestehen."
          ),
        })
        .end();
    }
    try {
      const userResult = await database.query(
        "SELECT * FROM accounts WHERE email = $1",
        [email]
      );
      const tokenResult = await database.query(
        "SELECT * FROM recovery_requests WHERE token = $1",
        [token]
      );
      if (userResult.rows.length > 0 && tokenResult.rows.length > 0) {
        const user = userResult.rows[0];
        const request = tokenResult.rows[0];
        if (user.id === request.user_id) {
          const account = await Account.fromDatabase(userResult.rows[0].id);
          if (account) {
            account.changePassword(password);
            database.query("DELETE FROM recovery_requests WHERE token = $1", [
              token,
            ]);
            return res
              .status(200)
              .json({ message: "Passwort geändert." })
              .end();
          }
        } else {
          return res
            .status(400)
            .json({ message: "Fehlerhafte Anfrage." })
            .end();
        }
      } else {
        return res.status(400).json({ message: "Fehlerhafte Anfrage." }).end();
      }
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Interner Fehler." }).end();
    }
  }
);

router.put(
  "/:username/password",
  requireBody("oldPassword"),
  requireBody("newPassword"),
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (!req.account) {
      return res
        .status(403)
        .json({ message: escapeHTML("Nicht eingeloggt.") })
        .end();
    }
    const account = req.account;
    const username = req.params.username;
    if (account.username !== username) {
      return res
        .status(403)
        .json({ message: escapeHTML("Keine Berechtigung.") })
        .end();
    }
    const oldPassword: string = req.body.oldPassword;
    const newPassword: string = req.body.newPassword;
    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({
          message: escapeHTML(
            "Das Passwort muss aus mindestens 8 Zeichen bestehen."
          ),
        })
        .end();
    }
    try {
      const authenticated = await account.checkPassword(oldPassword);
      if (authenticated) {
        account.changePassword(newPassword);
      } else {
        return res
          .status(403)
          .json({ message: escapeHTML("Falsches Passwort.") });
      }
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: escapeHTML("Interner Fehler.") });
    }
  }
);

router.put(
  "/:username/email",
  requireBody("passwordConfirmation"),
  requireBody("newEmail"),
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const account: Account = req.account;
    if (!account) {
      return res
        .status(403)
        .json({ message: escapeHTML("Nicht eingeloggt.") })
        .end();
    }
    const username = req.params.username;
    if (account.username !== username) {
      return res
        .status(403)
        .json({ message: escapeHTML("Keine Berechtigung.") })
        .end();
    }
    const passwordConfirmation = req.body.passwordConfirmation;
    const newEmail = req.body.newEmail;
    const mailverification = verifyEmail(newEmail, [
      "tu-dortmund.de",
      "udo.edu",
    ]);
    if (!mailverification.origin) {
      return res
        .status(400)
        .json({
          message: escapeHTML("E-Mail-Adresse muss eine Unimailadresse sein."),
        })
        .end();
    }
    if (!mailverification.format) {
      return res
        .status(400)
        .json({ message: escapeHTML("Keine gültige E-Mail-Adresse.") })
        .end();
    }
    const confirmed = await account.checkPassword(passwordConfirmation);
    if (confirmed) {
      account.changeEmail(newEmail);
      return res.status(200).json({ message: escapeHTML("E-Mail geändert.") });
    } else {
      return res
        .status(403)
        .json({ message: escapeHTML("Falsches Passwort.") })
        .end();
    }
  }
);

router.post(
  "/:username/sshkey",
  requireBody("passwordConfirmation"),
  requireBody("newKey"),
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const account = req.account;
    if (!account) {
      return res
        .status(403)
        .json({ message: escapeHTML("Nicht eingeloggt.") })
        .end();
    }
    const username = req.params.username;
    if (account.username !== username) {
      return res
        .status(403)
        .json({ message: escapeHTML("Keine Berechtigung.") })
        .end();
    }
    const passwordConfirmation = req.body.passwordConfirmation;
    const newKey = req.body.newKey;
    const confirmed = await account.checkPassword(passwordConfirmation);
    if (confirmed) {
      try {
        const keys = await account.getKeys();
        keys.push(newKey);
        account.setKeys(keys);
        return res.status(200).end();
      } catch {
        return res
          .status(500)
          .json({ message: escapeHTML("Interner Fehler.") });
      }
    } else {
      return res
        .status(403)
        .json({ message: escapeHTML("Passwortbestätigung fehlgeschlagen.") });
    }
  }
);

router.delete(
  "/:username/sshkey",
  requireBody("passwordConfirmation"),
  requireBody("delKey"),
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const account = req.account;
    if (!account) {
      return res
        .status(403)
        .json({ message: escapeHTML("Nicht eingeloggt.") })
        .end();
    }
    const username = req.params.username;
    if (account.username !== username) {
      return res
        .status(403)
        .json({ message: escapeHTML("Keine Berechtigung.") })
        .end();
    }
    const passwordConfirmation = req.body.passwordConfirmation;
    const delKey = req.body.delKey;
    const confirmed = await account.checkPassword(passwordConfirmation);
    if (confirmed) {
      try {
        const keys = await account.getKeys();
        const filtered = keys.filter((key) => key !== delKey);
        account.setKeys(filtered);
        return res.status(200).end();
      } catch {
        return res
          .status(500)
          .json({ message: escapeHTML("Interner Fehler.") });
      }
    } else {
      return res
        .status(403)
        .json({ message: escapeHTML("Passwortbestätigung fehlgeschlagen.") });
    }
  }
);

router.delete(
  "/:username",
  async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const account = req.account;
    const passwordConfirmation = req.body.passwordConfirmation;
    if (!account) {
      return res
        .status(403)
        .json({ message: escapeHTML("Nicht eingeloggt.") })
        .end();
    }
    const confirmed = await account.checkPassword(passwordConfirmation);
    if (account.roles.includes("admin") || confirmed) {
      //TODO Delete Account
      return res
        .status(404)
        .json({ message: escapeHTML("Nicht vollständig implementiert.") })
        .end();
    } else {
      return res
        .status(403)
        .json({ message: escapeHTML("Keine Berechtigung.") })
        .end();
    }
  }
);

export default router;
