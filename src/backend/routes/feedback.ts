import express from "express";
import { Request, Response, NextFunction } from "express";
import createError from "http-errors";
import database from "../database";
import { randomString } from "../../util";

import showdown from "showdown";
import { Account } from "../account";

import { QueryResult } from "pg";

import { new_comment_mail } from "../mailer";

const converter = new showdown.Converter();

interface Comment {
  id: number;
  author: string;
  markdown: string;
  html: string;
  slide: string;
  created: string;
  votes: number;
  didvote: boolean;
  answers: Answer[];
}

interface Answer {
  id: number;
  markdown?: string;
  html?: string;
  link?: string;
  created: string;
}

interface Person {
  id: number;
  token: string;
}

interface Session {
  user: number;
  token: string;
}

const router = express.Router();
router.use(express.text());

export async function setup_feedback() {
  const feedback_logins = await database.query(
    `CREATE TABLE IF NOT EXISTS feedback_logins (
            id SERIAL PRIMARY KEY,
            token VARCHAR NOT NULL UNIQUE,
            username VARCHAR NOT NULL UNIQUE
        )`
  );
  const feedback_persons = await database.query(
    `CREATE TABLE IF NOT EXISTS feedback_persons (
            id SERIAL PRIMARY KEY,
            token VARCHAR NOT NULL UNIQUE
        )`
  );
  const feedback_comments = await database.query(
    `CREATE TABLE IF NOT EXISTS feedback_comments (
            id SERIAL PRIMARY KEY,
            markdown VARCHAR NOT NULL,
            html VARCHAR NOT NULL,
            author INTEGER NULL REFERENCES feedback_persons,
            referrer VARCHAR NULL,
            deck VARCHAR NOT NULL,
            slide VARCHAR NOT NULL,
            created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`
  );
  const feedback_answers = await database.query(
    `CREATE TABLE IF NOT EXISTS feedback_answers (
            id SERIAL PRIMARY KEY,
            comment INTEGER NOT NULL REFERENCES feedback_comments,
            markdown VARCHAR NULL,
            link VARCHAR NULL,
            created TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`
  );
  const feedback_votes = await database.query(
    `CREATE TABLE IF NOT EXISTS feedback_votes (
            id SERIAL PRIMARY KEY,
            comment INTEGER NOT NULL REFERENCES feedback_comments,
            voter INTEGER NOT NULL REFERENCES feedback_persons
        )`
  );
}

async function isAdmin(token: string, deck: string): Promise<boolean> {
  const logins = await database.query(
    "SELECT * FROM feedback_logins WHERE token = $1",
    [token]
  );
  if (logins && logins.rows.length > 0) {
    const login = logins.rows[0];
    return login.token === token && deck.startsWith(login.username);
  }
  return false;
}

function deckPrefix(deck: string) {
  const parts = deck.split("-");
  return parts[0];
}

async function getPerson(input: string | number): Promise<Person | undefined> {
  if (typeof input === "string") {
    const persons = await database.query(
      "SELECT * FROM feedback_persons WHERE token = $1",
      [input]
    );
    if (persons && persons.rows.length > 0) {
      const id = persons.rows[0].id;
      const token = persons.rows[0].token;
      return { id, token };
    }
    return undefined;
  } else {
    const persons = await database.query(
      "SELECT * FROM feedback_persons WHERE id = $1",
      [input]
    );
    if (persons && persons.rows.length > 0) {
      const id = persons.rows[0].id;
      const token = persons.rows[0].token;
      return { id, token };
    }
  }
}

async function createPerson(token: string): Promise<Person> {
  const existing = await getPerson(token);
  if (existing) {
    return existing;
  } else {
    const created = await database.query(
      "INSERT INTO feedback_persons (token) VALUES ($1) RETURNING id",
      [token]
    );
    if (created && created.rows.length > 0) {
      const person = created.rows[0];
      return { id: person.id, token: token };
    } else {
      return { id: 0, token: token };
    }
  }
}

router.get(
  "/token",
  async function (request: Request, response: Response, next: NextFunction) {
    let random: string;
    do {
      random = randomString(9, "0123456789abcdefghijklmnopqrstuvwxyz");
    } while (await getPerson(random));
    return response.status(200).json({ random: random }).end();
  }
);

router.post(
  "/comments",
  async function (request: Request, response: Response, next: NextFunction) {
    let token, markdown, deck, slide, referrer, id;
    if (typeof request.body === "string") {
      const json = JSON.parse(request.body);
      token = json.token;
      markdown = json.markdown;
      deck = json.deck;
      slide = json.slide;
      referrer = json.location;
      id = json.id;
    } else {
      token = request.body.token;
      markdown = request.body.markdown;
      deck = request.body.deck;
      slide = request.body.slide;
      referrer = request.body.location;
      id = request.body.id;
    }
    if (!deck) {
      if (referrer) {
        console.log("[FEEDBACK] deck was null, setting deck to referrer");
        const url = new URL(referrer);
        url.hash = "";
        url.search = "";
        url.username = "";
        url.password = "";
        deck = url.toString();
      } else {
        console.error("deck null");
        deck = "unknown";
      }
    }
    if (markdown && token) {
      const author = await createPerson(token);
      const html = converter.makeHtml(markdown);
      let result;
      if (id) {
        const comments = await database.query(
          "SELECT * FROM feedback_comments WHERE id = $1",
          [id]
        );
        if (comments && comments.rows.length > 0) {
          const comment = comments.rows[0];
          const author: number = parseInt(comment.author);
          const person = await getPerson(author);
          if (token === person.token || (await isAdmin(token, deck))) {
            result = await database.query(
              `UPDATE feedback_comments SET
                            markdown = $1,
                            html = $2
                        WHERE id = $3 RETURNING id`,
              [markdown, html, id]
            );
          } else {
            return response.status(403).end();
          }
        } else {
          return response.status(404).end();
        }
      } else {
        try {
          result = await database.query(
            `INSERT INTO feedback_comments (markdown, html, author, referrer, deck, slide)
                   VALUES($1, $2, $3, $4, $5, $6)
                   RETURNING id`,
            [markdown, html, author.id, referrer, deck, slide]
          );
        } catch (error) {
          console.error(error);
          return response.status(500).end();
        }
      }
      if (result && result.rows.length > 0) {
        const owner = await Account.fromDatabase(deckPrefix(deck));
        if (owner) {
          new_comment_mail(owner.email, deck, slide, html, referrer);
        }
        return response.status(200).json(result.rows[0].id).end();
      } else {
        return response.status(500).end();
      }
    } else {
      return response.status(400).end();
    }
  }
);

router.put(
  "/comments",
  async function (request: Request, response: Response, next: NextFunction) {
    let token, deck, slide;
    if (typeof request.body === "string") {
      const json = JSON.parse(request.body);
      token = json.token;
      deck = json.deck;
      slide = json.slide;
    } else {
      token = request.body.token;
      deck = request.body.deck;
      slide = request.body.slide;
    }
    console.log(token, deck, slide);
    try {
      const voter = await getPerson(token);
      let comments: QueryResult<any>;
      if (!slide) {
        comments = await database.query(
          "SELECT * FROM feedback_comments WHERE deck = $1",
          [deck]
        );
      } else {
        comments = await database.query(
          "SELECT * FROM feedback_comments WHERE deck = $1 and slide = $2",
          [deck, slide]
        );
      }
      if (comments) {
        const result: Comment[] = [];
        for (const comment of comments.rows) {
          const id: number = comment.id;
          const author: number = comment.author;
          const person = await getPerson(author);
          const markdown: string = comment.markdown;
          const html: string = comment.html;
          const slide: string = comment.slide;
          const created: string = comment.created;
          const answers: Answer[] = [];
          const answersResult = await database.query(
            "SELECT * FROM feedback_answers WHERE comment = $1",
            [comment.id]
          );
          if (answersResult && answersResult.rows.length > 0) {
            for (const answer of answersResult.rows) {
              const id: number = answer.id;
              const created: string = answer.created;
              const markdown: string = answer.markdown;
              const html: string = converter.makeHtml(markdown);
              const link: string = answer.link;
              answers.push({ id, created, markdown, html, link });
            }
          }
          const votesResult = await database.query(
            "SELECT COUNT(id) FROM feedback_votes WHERE comment = $1",
            [comment.id]
          );
          const votes: number = parseInt(votesResult.rows[0].count);
          let didvote: boolean = false;
          if (voter) {
            const voteExists = await database.query(
              "SELECT COUNT(id) FROM feedback_votes WHERE comment = $1 AND voter = $2",
              [comment.id, voter.id]
            );
            const count: number = parseInt(voteExists.rows[0].count);
            didvote = count !== 0;
          }
          result.push({
            id: id,
            author: person.token,
            markdown: markdown,
            html: html,
            slide: slide,
            created: created,
            votes: votes,
            didvote: didvote,
            answers: answers,
          });
        }
        return response.status(200).json(result).end();
      } else {
        return response.status(200).json([]).end();
      }
    } catch (error) {
      console.error(error);
      response.status(500).end();
    }
  }
);

router.delete(
  "/comments",
  async function (request: Request, response: Response, next: NextFunction) {
    let id, token;
    if (typeof request.body === "string") {
      const json = JSON.parse(request.body);
      id = json.key;
      token = json.token;
    } else {
      id = request.body.key;
      token = request.body.token;
    }
    const result = await database.query(
      "SELECT * FROM feedback_comments WHERE id = $1",
      [id]
    );
    if (result && result.rows.length > 0) {
      const comment = result.rows[0];
      const author: number = parseInt(comment.author);
      const person = await getPerson(author);
      if (token === person.token || (await isAdmin(token, comment.deck))) {
        await database.query("DELETE FROM feedback_votes WHERE comment = $1", [
          id,
        ]);
        await database.query(
          "DELETE FROM feedback_answers WHERE comment = $1",
          [id]
        );
        await database.query("DELETE FROM feedback_comments WHERE id = $1", [
          id,
        ]);
        return response.status(200).end();
      }
    }
    return response.status(403).end();
  }
);

router.put(
  "/login",
  async function (request: Request, response: Response, next: NextFunction) {
    let login, password, deck;
    if (typeof request.body === "string") {
      const json = JSON.parse(request.body);
      login = json.login;
      password = json.password;
      deck = json.deck;
    } else {
      login = request.body.login;
      password = request.body.password;
      deck = request.body.deck;
    }
    const account = await Account.fromDatabase(login);
    const authenticated = await account.checkPassword(password);
    if (authenticated) {
      const sessions = await database.query(
        "SELECT * FROM feedback_logins WHERE username = $1",
        [account.username]
      );
      if (sessions && sessions.rows.length > 0) {
        const session = sessions.rows[0];
        const token = session.token;
        const admin = await isAdmin(token, deck);
        if (admin) {
          return response.status(200).json({ admin: token }).end();
        } else {
          return response.status(403).end();
        }
      } else {
        const random = randomString(9, "0123456789abcdefghijklmnopqrstuvwxyz");
        const result = await database.query(
          "INSERT INTO feedback_logins (username, token) VALUES ($1, $2)",
          [account.username, random]
        );
        const admin = await isAdmin(random, deck);
        if (admin) {
          return response.status(200).json({ admin: random }).end();
        } else {
          return response.status(403).end();
        }
      }
    } else {
      return response.status(403).end();
    }
  }
);

router.put(
  "/vote",
  async function (request: Request, response: Response, next: NextFunction) {
    let comment, voter;
    if (typeof request.body === "string") {
      const json = JSON.parse(request.body);
      comment = json.comment;
      voter = json.voter;
    } else {
      comment = request.body.comment;
      voter = request.body.voter;
    }
    const person: Person = await createPerson(voter);
    const result = await database.query(
      "SELECT * FROM feedback_votes WHERE comment = $1 AND voter = $2",
      [comment, person.id]
    );
    let didvote = false;
    if (result && result.rows.length > 0) {
      didvote = true;
    }
    if (didvote) {
      await database.query(
        "DELETE FROM feedback_votes WHERE comment = $1 AND voter = $2",
        [comment, person.id]
      );
    } else {
      await database.query(
        "INSERT INTO feedback_votes (comment, voter) VALUES ($1, $2)",
        [comment, person.id]
      );
    }
    return response.status(200).end();
  }
);

router.post(
  "/answers",
  async function (request: Request, response: Response, next: NextFunction) {
    let token, comment, markdown, link;
    if (typeof request.body === "string") {
      const json = JSON.parse(request.body);
      token = json.token;
      comment = json.comment;
      markdown = json.markdown;
      link = json.link;
    } else {
      token = request.body.token;
      comment = request.body.comment;
      markdown = request.body.markdown;
      link = request.body.link;
    }
    const commentResult = await database.query(
      "SELECT * FROM feedback_comments WHERE id = $1",
      [comment]
    );
    if (commentResult && commentResult.rows.length > 0) {
      const deck = commentResult.rows[0].deck;
      const admin = await isAdmin(token, deck);
      if (admin) {
        await database.query(
          "INSERT INTO feedback_answers (comment, markdown, link, created) VALUES ($1, $2, $3, NOW())",
          [comment, markdown, link]
        );
        return response.status(200).end();
      } else {
        return response.status(403).end();
      }
    } else {
      return response.status(404).end();
    }
  }
);

router.delete(
  "/answers",
  async function (request: Request, response: Response, next: NextFunction) {
    let token, id;
    if (typeof request.body === "string") {
      const json = JSON.parse(request.body);
      token = json.token;
      id = json.key;
    } else {
      token = request.body.token;
      id = request.body.key;
    }
    const answerResult = await database.query(
      "SELECT * FROM feedback_answers WHERE id = $1",
      [id]
    );
    if (answerResult && answerResult.rows.length > 0) {
      const comment = answerResult.rows[0].comment;
      const commentResult = await database.query(
        "SELECT * FROM feedback_comments WHERE id = $1",
        [comment]
      );
      if (commentResult && commentResult.rows.length > 0) {
        const deck = commentResult.rows[0].deck;
        const admin = await isAdmin(token, deck);
        if (admin) {
          await database.query("DELETE FROM feedback_answers WHERE id = $1", [
            id,
          ]);
          return response.status(200).end();
        } else {
          return response.status(403).end();
        }
      }
    } else {
      return response.status(404).end();
    }
  }
);

export default router;
