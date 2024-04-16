require("module-alias/register");
import database from "./backend/database";
import { Account } from "./backend/account";

import { exportFeedbackUsers } from "./backend/legacy.feedback";
import { AccountRequest } from "./backend/request";

type Operation = {
  fn: (...args: string[]) => Promise<void>;
  argn: number;
};

const ops: Map<string, Operation> = new Map<string, Operation>();

function registerOperation(arg: string, operation: Operation) {
  ops.set(arg, operation);
}

registerOperation("--version", { fn: printVersion, argn: 0 });
registerOperation("--list-feedback", {
  fn: listFeedbackUsers,
  argn: 0,
});
registerOperation("--list-accounts", {
  fn: listAccounts,
  argn: 0,
});
registerOperation("--list-requests", {
  fn: listRequests,
  argn: 0,
});
registerOperation("--export-feedback", { fn: exportFeedbackUsers, argn: 0 });
registerOperation("--delete-feedback", { fn: deleteFeedbackUser, argn: 1 });
registerOperation("--delete-account", { fn: deleteAccount, argn: 1 });
registerOperation("--delete-request", { fn: deleteRequest, argn: 1 });
registerOperation("--create-account", { fn: createAccount, argn: 3 });
registerOperation("--create-request", { fn: createRequest, argn: 3 });

main();

async function readArguments() {
  for (let index = 0; index < process.argv.length; index++) {
    const arg = process.argv[index];
    const op = ops.get(arg);
    if (op) {
      const args: string[] = [];
      for (let i = 0; i < op.argn; i++) {
        const argidx = index + i + 1;
        if (argidx >= process.argv.length) {
          console.error("Not enough arguments specified.");
          return;
        }
        args.push(process.argv[argidx]);
      }
      await op.fn(...args);
      index += op.argn;
    }
  }
}

async function main() {
  await readArguments();
  await database.disconnect();
}

async function printVersion() {
  console.log("Version: 1.0.0");
}

async function listAccounts() {
  try {
    const requests = await database.query(
      "SELECT id, username, email, created FROM accounts"
    );
    const rows = requests.rows;
    console.table(rows);
  } catch (error) {
    console.error(error);
  }
}

async function listFeedbackUsers() {
  try {
    const requests = await database.query("SELECT * FROM feedback_accounts");
    const rows = requests.rows;
    console.table(rows);
  } catch (error) {
    console.error(error);
  }
}

async function listRequests() {
  try {
    const requests = await database.query(
      "SELECT id, username, email, token, note, created FROM account_requests"
    );
    const rows = requests.rows;
    console.table(rows);
  } catch (error) {
    console.error(error);
  }
}

async function deleteFeedbackUser(id: string) {
  try {
    const result = await database.query(
      "DELETE FROM feedback_accounts WHERE id = $1",
      [id]
    );
    console.log(`DELETED ${result.rowCount} feedback users.`);
  } catch (error) {
    console.error(error);
  }
}

async function deleteRequest(id: string) {
  try {
    const result = await database.query(
      "DELETE FROM account_requests WHERE id = $1",
      [id]
    );
    console.log(`DELETED ${result.rowCount} requests.`);
  } catch (error) {
    console.error(error);
  }
}

async function deleteAccount(id: string) {
  try {
    const result = await database.query("DELETE FROM accounts WHERE id = $1", [
      id,
    ]);
    console.log(`DELETED ${result.rowCount} accounts.`);
  } catch (error) {
    console.error(error);
  }
}

async function createAccount(
  username: string,
  email: string,
  password: string
) {
  try {
    Account.register(username, email, password);
  } catch (error) {
    console.error(error);
  }
}

function makeRandomString(length: number, characters?: string): string {
  let result = "";
  let options = characters
    ? characters
    : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let amount = options.length;
  for (let i = 0; i < length; i++) {
    result += options.charAt(Math.floor(Math.random() * amount));
  }
  return result;
}

async function createRequest(username: string, email: string, reason: string) {
  try {
    const available = await AccountRequest.isAvailable(username);
    if (available) {
      const randomToken: string = makeRandomString(64);
      const request = await AccountRequest.reserve(
        username,
        email,
        randomToken,
        reason
      );
    } else {
      console.error(`Username ${username} is not available.`);
    }
  } catch (error) {
    console.error(error);
  }
}
