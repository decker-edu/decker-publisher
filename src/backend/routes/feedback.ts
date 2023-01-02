import express from "express";
import { Request, Response, NextFunction} from "express";
import createError from "http-errors";
import database from "../database";
import { randomString } from "util.ts";

import showdown from "showdown";
import { Account } from "../account";

const converter = new showdown.Converter();

interface Comment {
    id: number,
    author: string,
    markdown: string,
    html: string,
    slide: string,
    created: string,
    votes: number,
    didvote: boolean,
    answers: Answer[]
}

interface Answer {
    id: number,
    markdown?: string,
    html?: string,
    link?: string,
    created: string
}

interface Person {
    id: number,
    token: string
}

interface Session {
    user: number;
    token: string;
}

const router = express.Router();

export async function setup() {
    await database.query("CREATE TABLE IF NOT EXISTS 'feedback_logins' ('id' SERIAL PRIMARY KEY, 'token' VARCHAR NOT NULL UNIQUE, 'username' VARCHAR NOT NULL UNIQUE)");
    await database.query("CREATE TABLE IF NOT EXISTS 'feedback_persons' ('id' SERIAL PRIMARY KEY, 'token' VARCHAR NOT NULL UNIQUE)");
    await database.query("CREATE TABLE IF NOT EXISTS 'feedback_comments' ('id' SERIAL PRIMARY KEY, 'markdown' VARCHAR NOT NULL, 'html' VARCHAR NOT NULL, 'author' INTEGER NULL REFERENCES 'feedback_persons', 'referrer' VARCHAR NULL, 'deck' VARCHAR NOT NULL, 'slide' VARCHAR NOT NULL, 'created' TIMESTAMP NOT NULL DEFAULT CURRENT_TIME)");
    await database.query("CREATE TABLE IF NOT EXISTS 'feedback_answers' ('id' SERIAL PRIMARY KEY, 'comment' INTEGER NOT NULL REFERENCES 'feedback_comments', 'markdown' VARCHAR NULL, 'link' VARCHAR NULL, 'crated' TIMESTAMP NOT NULL DEFAULT CURRENT_TIME)");
    await database.query("CREATE TABLE IF NOT EXISTS 'feedback_votes' ('id' SERIA PRIMARY KEY, 'comment' INTEGER NOT NULL REFERENCES 'feedback_comments', 'voter' INTEGER NOT NULL REFERENCES 'feedback_persons'");
}

async function isAdmin(token : string, deck : string) : Promise<boolean> {
    const logins = await database.query("SELECT * FROM feedback_logins WHERE token = $1", [token]);
    if(logins && logins.rows.length > 0) {
        const login = logins.rows[0];
        return login.token === token && deck.startsWith(login.username);
    }
    return false;
}

async function getPerson(token : string) : Promise<Person | undefined> {
    const persons = await database.query("SELECT * FROM feedback_persons WHERE token = $1", [token]);
    if(persons && persons.rows.length > 0) {
        const id = persons.rows[0].id;
        const token = persons.rows[0].token;
        return {id, token};
    }
    return undefined;
}

router.get("/token", async function (request : Request, response : Response, next : NextFunction) {
    const random = randomString(9, "0123456789abcdefghijklmnopqrstuvwxyz");
    const result = await database.query("INSERT INTO feedback_persons (token) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id", [random]);
    if(result && result.rows.length > 0) {
        const id = result.rows[0].id;
    }
    return response.status(200).json({random: random}).end();
});

router.post("/comments", async function (request : Request, response : Response, next : NextFunction) {
    const token = request.body.token;
    const markdown = request.body.markdown;
    const deck = request.body.deck;
    const slide = request.body.slide;
    const referrer = request.body.referrer;
    if(markdown) {
        const html = converter.makeHtml(markdown);
        const result = await database.query("INSERT INTO feedback_comments (markdown, html, author, referrer, deck, slide) VALUES($1, $2, $3, $4, $5) RETURNING id",
        [markdown, html, token, referrer, deck, slide]);
        if(result && result.rows.length > 0) {
            return response.status(200).end();
        }
    } else {
        return response.status(400).end();
    }

});

router.put("/comments", async function (request : Request, response : Response, next : NextFunction) {
    const token = request.body.token;
    const deck = request.body.deck;
    const slide = request.body.slide;
    try {
        const comments = await database.query("SELECT * FROM feedback_comments WHERE deck = $1 and slide = $2", [deck, slide]);
        if(comments) {
            const result : Comment[] = [];
            for(const comment of comments.rows) {
                const id : number = comment.id;
                const author : string = comment.author;
                const markdown : string = comment.markdown;
                const html : string = comment.html;
                const slide : string = comment.slide;
                const created : string = comment.created;
                const answers : Answer[] = [];
                const answersResult = await database.query("SELECT * FROM feedback_answers WHERE comment = $1", [comment.id]);
                if(answersResult && answersResult.rows.length > 0) {
                    for(const answer of answersResult.rows) {
                        const id : number = answer.id;
                        const created : string = answer.created;
                        const markdown : string = answer.markdown;
                        const html : string = converter.makeHtml(markdown);
                        const link : string = answer.link;
                        answers.push({id, created, markdown, html, link});
                    }
                }
                const votesResult = await database.query("SELECT COUNT(id) FROM feedback_votes WHERE comment = $1", [comment.id]);
                const votes = votesResult.rows[0];
                const voteExists = await database.query("SELECT COUNT(id) FROM feedback_votes WHERE comment = $1 AND voter = $2", [comment.id, token]);
                const didvote : boolean = voteExists.rows[0] !== 0;
                result.push({
                    id, author, markdown, html, slide, created, votes, didvote, answers
                })
            }
        }
    } catch (error) {
        response.status(500).end();
    }
});

router.delete("/comments", async function (request : Request, response : Response, next : NextFunction) {
    const id = request.body.id;
    const token = request.body.token;
    const result = await database.query("SELECT * FROM feedback_comments WHERE id = $1", [id]);
    if(result && result.rows.length > 0) {
        const comment = result.rows[0];
        const author = comment.token;
        if(token === author || isAdmin(token, comment.deck)) {
            await database.query("DELETE FROM feedback_comments WHERE id = $1");
            return response.status(200).end();
        }
    }
    return response.status(403).end();
});

router.put("/login", async function (request : Request, response : Response, next : NextFunction) {
    const login = request.body.login;
    const password = request.body.password;
    const deck = request.body.deck;
    const account = await Account.fromDatabase(login);
    const authenticated = await account.checkPassword(password);
    if(authenticated) {
        const sessions = await database.query("SELECT * FROM feedback_logins WHERE username = $1", [account.username]);
        if(sessions && sessions.rows.length > 0) {
            const session = sessions.rows[0];
            const token = session.token;
            const admin = isAdmin(token, deck);
            if(admin) {
                return response.status(200).json({admin: token}).end();
            } else {
                return response.status(403).end();
            }
        } else {
            const random = randomString(9, "0123456789abcdefghijklmnopqrstuvwxyz");
            const result = await database.query("INSERT INTO feedback_logins (username, token) VALUES ($1, $2)", [account.username, random]);
            return response.status(200).json({admin: random}).end();
        }
    } else {
        return response.status(403).end();
    }
});

router.put("/vote", async function (request : Request, response : Response, next : NextFunction) {
    const comment = request.body.comment;
    const voter = request.body.voter;
    const result = await database.query("SELECT * FROM feedback_votes WHERE comment = $1 AND voter = $2", [comment, voter]);
    let didvote = false;
    if(result && result.rows.length > 0) {
        didvote = true;
    }
    if(didvote) {
        await database.query("DELETE * FROM feedback_votes WHERE comment = $1 AND voter = $2", [comment, voter]);
    } else {
        const person : Person | undefined = await getPerson(voter); 
        if(!person) {
            await database.query("INSERT INTO feedback_persons (token) VALUES ($1)", [voter]);
        }
        await database.query("INSERT INTO feedback_votes (comment, voter) VALUES ($1, $2)", [comment, voter]);
    }
});

router.post("/answers", async function (request : Request, response : Response, next : NextFunction) {
    const token = request.body.token;
    const comment = request.body.comment;
    const markdown = request.body.markdown;
    const link = request.body.link;
    const commentResult = await database.query("SELECT * FROM feedback_comments WHERE id = $1", [comment]);
    if(commentResult && commentResult.rows.length > 0) {
        const deck = commentResult.rows[0].deck;
        const admin = await isAdmin(token, deck);
        if(admin) {
            await database.query("INSERT INTO feedback_answers (comment, markdown, link, created) VALUES ($1, $2, $3, NOW())", [comment, markdown, link]);
        } else {
            return response.status(403).end();
        }
    } else {
        return response.status(404).end();
    }
});

router.delete("/answers", async function (request : Request, response : Response, next : NextFunction) {
    const token = request.body.token;
    const id = request.body.id;
    const answerResult = await database.query("SELECT * FROM feedback_answers WHERE id = $1", [id]);
    if(answerResult && answerResult.rows.length > 0) {
        const comment = answerResult.rows[0].comment;
        const commentResult = await database.query("SELECT * FROM feedback_comments WHERE id = $1", [comment]);
        if(commentResult && commentResult.rows.length > 0) {
            const deck = commentResult.rows[0].deck;
            const admin = await isAdmin(token, deck);
            if(admin) {
                await database.query("DELETE * FROM feedback_answers WHERE id = $1", [id]);
            } else {
                return response.status(403).end();
            }
        }
    }
});

export default router;