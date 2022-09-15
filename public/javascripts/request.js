function openRequestDialog() {
  let dialog = document.getElementById("request-dialog");
  dialog.showModal();
}

function closeRequestDialog() {
  let dialog = document.getElementById("request-dialog");
  dialog.close();
}

function displayRequestDialogMessage(message, type) {
  let element = document.getElementById("request-message");
  element.classList.remove("message-error");
  element.classList.remove("message-success");
  if (type && type === "success") {
    element.classList.add("message-success");
  } else if (type && type === "error") {
    element.classList.add("message-error");
  }
  element.innerText = message;
}

function asyncRequest() {
  let userElement = document.getElementById("request-user");
  let mailElement = document.getElementById("request-mail");
  let noteElement = document.getElementById("request-note");
  let username = userElement.value;
  let email = mailElement.value;
  let note = noteElement.value;
  fetch("/api/request", {
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
  })
    .then((response) => {
      return response.json();
    })
    .then((json) => {
      if (json.status === "success") {
        displayRequestDialogMessage(json.message, "success");
      } else {
        displayRequestDialogMessage(json.message, "error");
      }
    });
}
