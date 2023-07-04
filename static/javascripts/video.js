function closeVideoDialog() {
  let dialog = document.getElementById("video-dialog");
  dialog.close();
}

function showVideoDialogMessage(message, type) {
  let element = document.getElementById("video-message");
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

let dialogProject = undefined;
let dialogFilepath = undefined;

function openVideoDialog(project, filepath) {
  dialogProject = project;
  dialogFilepath = filepath;
  let dialog = document.getElementById("video-dialog");
  showVideoDialogMessage("Videodaten werden geladen.", "information");
  let filenameField = document.getElementById("video-filename");
  if (filenameField) {
    filenameField.innerText = null;
  }
  let lengthField = document.getElementById("video-length");
  if (lengthField) {
    lengthField.innerText = null;
  }
  let subtitleField = document.getElementById("video-hasvtt");
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
        showVideoDialogMessage(null, null);
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

function navigateToVideo() {
  if (!dialogFilepath) {
    console.error(
      "Navigation triggered without filepath. This should not be possible."
    );
    return;
  }
  window.location.replace(
    `/video?project=${dialogProject}&filepath=${dialogFilepath}`
  );
}

function activateVTTEditor() {
  const saveButton = document.getElementById("save-button");
  saveButton.disabled = false;
  const area = document.getElementById("vtt-area");
  area.disabled = false;
  area.focus();
}

function openSaveDialog() {
  const diag = document.getElementById("vtt-dialog");
  diag.showModal();
}

function closeSaveDialog() {
  const diag = document.getElementById("vtt-dialog");
  diag.close();
}

async function saveSubtitles(username, project, filename) {
  const area = document.getElementById("vtt-area");
  const subtitles = area.value;
  try {
    const blob = new Blob([subtitles], { type: "text/plain" });
    const file = new File([blob], filename);
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(
      `/api/project/${username}/${project}/files/${filename}`,
      {
        method: "POST",
        cache: "no-cache",
        body: formData,
      }
    );
    if (response.ok) {
      const message = document.getElementById("vtt-message");
      if (message) {
        message.innerText = "Daten erfolgreich übermittelt.";
        setTimeout(() => closeSaveDialog(), 2000);
      }
    } else {
      const json = await response.json();
      if (json.message) {
        const message = document.getElementById("vtt-message");
        if (message) {
          message.innerText = "Es ist ein Fehler aufgetreten: " + json.message;
        }
      } else {
        const message = document.getElementById("vtt-message");
        if (message) {
          message.innerText = "Es ist ein unerwarteter Fehler aufgetreten.";
        }
      }
    }
  } catch (error) {
    const message = document.getElementById("vtt-message");
    if (message) {
      console.error(error);
      message.innerText =
        "Es ist ein Fehler bei der Datenübertragung aufgetreten.";
    }
  }
}
