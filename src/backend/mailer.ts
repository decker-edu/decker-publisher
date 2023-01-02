import config from "../../config.json";
import child_process from "child_process";

export function recoveryMail(recepient : string, token : string) {
  if (
    config.mail_config &&
    config.mail_config.mail_program &&
    config.mail_config.mail_program !== ""
  ) {
    try {
      const process = child_process.spawn(
        `${config.mail_config.mail_program}`,
        ["-t"]
      );
      process.stdin.write("From: " + config.mail_config.mail_from + "\n");
      process.stdin.write("To: " + recepient + "\n");
      process.stdin.write("Subject: Decker: Passwort zuruecksetzen\n\n");
      process.stdin.write(
        `Guten Tag,\n\
    für Ihr Nutzerkonto wurde eine Anfrage zum Zurücksetzen des Passworts gestellt.\n\
Zum zurücksetzen Ihres Passworts benutzen Sie bitte folgenden Link:\n\n\
${config.hostname}/password-reset/${token}\n\n\
Sollten Sie keine solche Anfrage gestellt haben können Sie diese E-Mail ignorieren.\n\n\
Mit freundlichen Grüßen\n\
    Das Decker System\n`
      );
      process.stdin.end();
    } catch (error) {
      console.error(error);
      return;
    }
  } else {
    console.error("Kein Mailprogramm konfiguriert.");
    return;
  }
}