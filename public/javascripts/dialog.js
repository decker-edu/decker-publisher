let currentDialog = undefined;

function openDialog({ message, form }) {
  if (!currentDialog) {
    currentDialog = document.createElement("dialog");
    let messageElement = document.createElement("div");
    let formElement = document.createElement("form");
  }
}
