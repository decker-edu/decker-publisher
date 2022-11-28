async function requestRecovery() {
  const element = document.getElementById("email");
  if (element) {
    const email = element.value;
    try {
      const response = await fetch("/api/request-recovery", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recoveryEmail: email,
        }),
      });
      if (response.ok) {
        const json = await response.json();
        const msg = json.message;
        document.getElementById("recovery-message").innerText = msg;
        document.getElementById("email").value = "";
      } else {
        const json = await response.json();
        const msg = json.message;
        document.getElementById("recovery-message").innerText = msg;
      }
    } catch (error) {
      document.getElementById("recovery-message").innerText =
        "Fehler beim Senden der Anfrage.";
    }
  }
}

function setResetMessage(message, type) {
  let element = document.getElementById("reset-message");
  element.classList.remove("message-error");
  element.classList.remove("message-success");
  if (type && type === "success") {
    element.classList.add("message-success");
  } else if (type && type === "error") {
    element.classList.add("message-error");
  }
  element.innerText = message;
}

async function resetPassword() {
  const mailfield = document.getElementById("email");
  const tokenfield = document.getElementById("token");
  const passwordfield1 = document.getElementById("first-password");
  const passwordfield2 = document.getElementById("second-password");
  if (!mailfield || !tokenfield || !passwordfield1 || !passwordfield2) {
    setResetMessage("Fehler beim auswerten des Formulars.", "message-error");
    return;
  }
  const mail = mailfield.value;
  const token = tokenfield.value;
  const pass1 = passwordfield1.value;
  const pass2 = passwordfield2.value;
  if (
    !mail ||
    !token ||
    !pass1 ||
    !pass2 ||
    mail === "" ||
    token === "" ||
    pass1 === "" ||
    pass2 === ""
  ) {
    setResetMessage("Formular unvollständig.", "error");
    return;
  }
  if (pass1 != pass2) {
    setResetMessage("Passwörter stimmen nicht überein.", "error");
    return;
  }
  const response = await fetch("/api/user/reset-password", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: mail,
      token: token,
      newPassword: pass1,
    }),
  });
  if (response.ok) {
    const json = await response.json();
    setResetMessage(json.message, "success");
    setTimeout(() => {
      window.location.replace("/");
    }, 1500);
  } else {
    const json = await response.json();
    setResetMessage(json.message, "error");
  }
}
