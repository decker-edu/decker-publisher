const Errors = require("../types/errors");
const db = require("../db");

module.exports = function (request, response, next) {
  if (request.session && request.session.user) {
    const user_id = request.session.user;
    db.getAccountByID(user_id)
      .then((account) => {
        request.account = account;
        next();
      })
      .catch((error) => {
        if (error === Errors.USER_NOT_FOUND) {
          request.account = undefined;
          next();
        } else {
          console.error(error);
          request.account = undefined;
          next();
        }
      });
  } else if (request.body.username && request.body.password) {
    db.getAccountByName(request.body.username)
      .then((account) => {
        account.checkPassword(request.body.password).then((success) => {
          if (success) {
            request.account = account;
            next();
          } else {
            request.account = undefined;
            next();
          }
        });
      })
      .catch((error) => {
        request.account = undefined;
        next();
      });
  } else {
    request.account = undefined;
    next();
  }
};
