const express = require("express");
const router = express.Router();
const escape = require("escape-html");

const db = require("../db");
const cache = require("../cache");
const Account = require("../types/account");
const Errors = require("../types/errors");

router.get("/", (req, res, next) => {
  cache.authenticate(req, (error, account) => {
    if (error) {
      return res.render("error", { error: { message: "Not authenticated." } });
    }
    account.hasRole("admin", (error, admin) => {
      //TODO unhardcode role name
      if (error) {
        return res.render("error", {
          error: {
            message: "Internal Server Error",
            error: {
              status: 500,
              stack: "",
            },
          },
        });
      }
      if (admin) {
        return res.render("admin", {
          title: "Administration",
          user: { username: account.username },
          admin: true,
        });
      } else {
        return res.render("error", {
          error: {
            message: "Not authenticated.",
            error: {
              status: 403,
              stack: "",
            },
          },
        });
      }
    });
  });
});

router.get("/users", (req, res, next) => {
  cache.authenticate(req, (error, account) => {
    if (error) {
      return res.render("error", { error: { message: "Not authenticated." } });
    }
    account.hasRole("admin", (error, admin) => {
      //TODO unhardcode role name
      if (error) {
        return res.render("error", {
          error: { message: "Internal Server Error" },
        });
      }
      if (admin) {
        cache.getAllAccounts((error, accounts) => {
          if (error) {
            return res.render("error", {
              message: "Error while fetching accounts.",
              error: {
                status: 404,
                stack: error,
              },
            });
          }
          return res.render("admin-users", {
            title: "Benutzeradministration",
            user: { username: account.username },
            admin: true,
            accounts: accounts,
          });
        });
      } else {
        return res.render("error", {
          error: { message: "Not authenticated." },
        });
      }
    });
  });
});

router.get("/requests", (req, res, next) => {
  cache.authenticate(req, (error, account) => {
    if (error) {
      return res.render("error", { error: { message: "Not authenticated." } });
    }
    account.hasRole("admin", (error, admin) => {
      //TODO unhardcode role name
      if (error) {
        return res.render("error", {
          error: { message: "Internal Server Error" },
        });
      }
      if (admin) {
        cache.getAllRequests((error, requests) => {
          for (let request of requests) {
            request.note = escape(request.note);
          }
          if (error) {
            console.error(error);
            if (error === Errors.NO_RESULTS) {
              return res.render("admin-requests", {
                title: "Anfrageadministration",
                user: { username: account.username },
                admin: true,
                requests: undefined,
              });
            }
            return res.render("error", {
              message: "Error while fetching requests.",
              error: {
                status: 404,
                stack: error.toString(),
              },
            });
          }
          return res.render("admin-requests", {
            title: "Anfrageadministration",
            user: { username: account.username },
            admin: true,
            requests: requests,
          });
        });
      } else {
        return res.render("error", {
          error: { message: "Not authenticated." },
        });
      }
    });
  });
});

module.exports = router;
