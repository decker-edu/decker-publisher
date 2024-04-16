import config from "@root/config";
import child_process from "child_process";

export function recoveryMail(recepient: string, token: string) {
  if (
    config().mail_config &&
    config().mail_config.mail_program &&
    config().mail_config.mail_program !== ""
  ) {
    try {
      const process = child_process.spawn(
        `${config().mail_config.mail_program}`,
        ["-t"]
      );
      process.stdin.write("From: " + config().mail_config.mail_from + "\n");
      process.stdin.write("To: " + recepient + "\n");
      process.stdin.write("Subject: Decker: Passwort zuruecksetzen\n\n");
      process.stdin.write(
        `Guten Tag,\n\
    für Ihr Nutzerkonto wurde eine Anfrage zum Zurücksetzen des Passworts gestellt.\n\
Zum zurücksetzen Ihres Passworts benutzen Sie bitte folgenden Link:\n\n\
${config().hostname}/password-reset/${token}\n\n\
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

export function new_comment_mail(
  recepient: string,
  deck: string,
  slide: string,
  text: string,
  referrer: string
) {
  if (
    config().mail_config &&
    config().mail_config.mail_program &&
    config().mail_config.mail_program !== ""
  ) {
    try {
      const process = child_process.spawn(
        `${config().mail_config.mail_program}`,
        ["-t"]
      );
      process.stdin.write("From: " + config().mail_config.mail_from + "\n");
      process.stdin.write("MIME-Version: 1.0\n");
      process.stdin.write("Content-Type: text/html\n");
      process.stdin.write("To: " + recepient + "\n");
      process.stdin.write(
        "Subject: Decker: Neue Frage im deck: " + deck + "\n\n"
      );
      process.stdin.write(
        `<!DOCTYPE HTML>
<html>
<head><title>Neue Frage im deck: ${deck}</title>
<body>
<h1>Neue Frage im deck: ${deck}</h1>
<h2>Folie: <a href=${referrer}>${slide}</a></h2>
<div>${text}</div>
</body>
</html>`
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

export function requestMail(
  recepient: string,
  accountname: string,
  email: string,
  comment: string
) {
  if (
    config().mail_config &&
    config().mail_config.mail_program &&
    config().mail_config.mail_program !== ""
  ) {
    console.log("[MAIL] trying to send mail to:", recepient);
    try {
      const process = child_process.spawn(
        `${config().mail_config.mail_program}`,
        ["-t"]
      );
      process.stdout.on("data", (data) => {
        console.log(data);
      });
      process.stdin.write("From: " + config().mail_config.mail_from + "\n");
      process.stdin.write("MIME-Version: 1.0\n");
      process.stdin.write("Content-Type: text/html\n");
      process.stdin.write("To: " + recepient + "\n");
      process.stdin.write("Subject: Decker: Neue Accountanfrage\n\n");
      process.stdin.write(
        `<!DOCTYPE HTML>
<html>
<head><title>Neue Accountanfrage</title>
<body>
<h1>Neue Accountanfrage</h1>
<div><p>Accountname: ${accountname}</p></div>
<div><p>E-Mail: ${email}</p></div>
<div><p>Anmerkung: ${comment}</p></div>
</body>
</html>`
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
