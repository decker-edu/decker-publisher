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

window.displayTooltip = function (element, text) {
  const tooltip = document.createElement("div");
  tooltip.classList.add("tooltip");
  const wedge = document.createElement("div");
  wedge.classList.add("wedgeup");
  tooltip.appendChild(wedge);
  const message = document.createElement("span");
  message.classList.add("tooltip-text");
  message.innerText = text;
  tooltip.appendChild(message);
  const box = element.getBoundingClientRect();
  tooltip.style.top = `${Math.floor(box.bottom) + 8}px`;
  tooltip.style.left = `${Math.floor(box.left)}px`;
  document.body.appendChild(tooltip);
  setTimeout(() => {
    tooltip.classList.add("fade");
    tooltip.addEventListener("transitionend", () => {
      tooltip.remove();
    });
  }, 1000);
};
