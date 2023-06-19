let currentDialog = undefined;

function openDialog(id) {
  const element = document.getElementById(id);
  if (element && element.tagName === "DIALOG") {
    currentDialog = element;
    element.showModal();
  }
}

function closeDialog(id) {
  if (id) {
    const element = document.getElementById(id);
    if (element && element.tagName === "DIALOG") {
      element.close();
      currentDialog = undefined;
    }
  } else {
    if (currentDialog) {
      currentDialog.close();
      currentDialog = undefined;
    }
  }
}

function displayMessage(message) {
  if (!currentDialog) return;
  const element = currentDialog.querySelector(".dialog-message");
  if (element) {
    element.innerText = message;
  }
}
