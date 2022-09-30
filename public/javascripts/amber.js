let amberProject = undefined;
let amberFilepath = undefined;

function requestAmber() {
  fetch("/api/amberscript", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      project: amberProject,
      filepath: amberFilepath,
    }),
  })
    .then((response) => {
      if (response.ok) {
        return response.json();
      } else {
        throw { status: response.status, message: "Fehler." };
      }
    })
    .then((json) => {
      showAmberDialogMessage(json.message, "success");
      setTimeout(() => {
        closeAmberDialog();
        window.location.replace("/ambers");
      }, 3000);
    })
    .catch((error) => {
      if (error.message) {
        showAmberDialogMessage(error.message, "error");
      } else {
        showAmberDialogMessage("Fehler.", "error");
      }
    });
}

function showAmberDialogMessage(message, type) {
  let element = document.getElementById("amber-message");
  element.classList.remove("message-error");
  element.classList.remove("message-success");
  element.classList.remove("message-info");
  if (type && type === "success") {
    element.classList.add("message-success");
  } else if (type && type === "information") {
    element.classList.add("message-info");
  } else if (type && type === "error") {
    element.classList.add("message-error");
  }
  element.innerText = message;
}

function openAmberDialog(project, filepath) {
  amberProject = project;
  amberFilepath = filepath;
  let dialog = document.getElementById("amber-dialog");
  showAmberDialogMessage("Videodaten werden geladen.", "information");
  let filenameField = document.getElementById("amber-filename");
  if (filenameField) {
    filenameField.innerText = null;
  }
  let lengthField = document.getElementById("amber-length");
  if (lengthField) {
    lengthField.innerText = null;
  }
  let subtitleField = document.getElementById("amber-hasvtt");
  if (subtitleField) {
    subtitleField.innerText = null;
  }
  dialog.showModal();
  fetch(`/api/video?project=${project}&file=${filepath}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  })
    .then((response) => {
      return response.json();
    })
    .then((json) => {
      if (json.status === "success") {
        showAmberDialogMessage(null, null);
        if (filenameField) {
          filenameField.innerText = filepath;
        }
        if (lengthField) {
          lengthField.innerText = json.data.length;
        }
        if (subtitleField) {
          if (json.data.vtt) {
            subtitleField.innerText = "Untertitel vorhanden";
          } else {
            subtitleField.innerText = "Keine Untertitel";
          }
        }
      }
    });
}

function closeAmberDialog() {
  let dialog = document.getElementById("amber-dialog");
  dialog.close();
}
