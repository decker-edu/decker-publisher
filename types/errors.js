const Errors = Object.freeze({
  USER_NOT_FOUND: Symbol("user-not-found"),
  AUTH_FAILED: Symbol("authentication-failed"),
  NO_RESULTS: Symbol("no-results"),
  DB_ERROR: Symbol("database-error"),
  UNSPECIFIED: Symbol("unspecified"),
});

module.exports = Errors;
