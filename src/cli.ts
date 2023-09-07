require("module-alias/register");
import database from "./backend/database";

import { exportFeedbackUsers } from "./backend/legacy.feedback";

enum Operation {
  PRINT_VERSION,
  EXPORT_FEEDBACK,
}

let operation: Operation = undefined;

for (let index = 0; index < process.argv.length; index++) {
  const arg = process.argv[index];
  if (arg === "--version") {
    operation = Operation.PRINT_VERSION;
  } else if (arg === "--export-feedback") {
    operation = Operation.EXPORT_FEEDBACK;
  }
}

switch (operation) {
  case Operation.PRINT_VERSION:
    {
      console.log("Version: 1.0.0");
    }
    break;
  case Operation.EXPORT_FEEDBACK:
    {
      exportFeedbackUsers();
    }
    break;
  default: {
    console.error("No valid operation has been specified.");
  }
}
