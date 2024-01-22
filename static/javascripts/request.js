function openRequestDialog() {
  let dialog = document.getElementById("request-dialog");
  dialog.showModal();
}

function closeRequestDialog() {
  let dialog = document.getElementById("request-dialog");
  dialog.close();
}

function openConfirmationDialog() {
  let dialog = document.getElementById("confirmation-dialog");
  dialog.showModal();
}

function closeConfirmationDialog() {
  let dialog = document.getElementById("confirmation-dialog");
  dialog.close();
}

function displayRequestDialogMessage(message, type) {
  let element;
  if (type && type === "success") {
    closeRequestDialog();
    element = document.getElementById("confirmation-message");
    element.classList.remove("message-error");
    element.classList.remove("message-success");
    element.classList.add("message-success");
    element.innerText = message;
    openConfirmationDialog();
  } else if (type && type === "error") {
    element = document.getElementById("request-message");
    element.classList.remove("message-error");
    element.classList.remove("message-success");
    element.classList.add("message-error");
    element.innerText = message;
  }
}

async function postRequest() {
  let userElement = document.getElementById("request-user");
  let mailElement = document.getElementById("request-mail");
  let noteElement = document.getElementById("request-note");
  let username = userElement.value;
  let email = mailElement.value;
  let note = noteElement.value;
  try {
    const response = await fetch("/api/request", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requestUser: username,
        requestMail: email,
        requestNote: note,
      }),
    });
    if (response.ok) {
      const json = await response.json();
      displayRequestDialogMessage(json.message, "success");
    } else {
      const json = await response.json();
      displayRequestDialogMessage(json.message, "error");
    }
  } catch (error) {
    console.error(error);
    displayRequestDialogMessage("Fehler während der Datenübertragung", "error");
  }
}
