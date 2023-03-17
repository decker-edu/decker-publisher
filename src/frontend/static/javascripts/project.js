let projectToDelete = undefined;
function openDeleteProjectDialog(name) {
  let dialog = document.getElementById("delete-dialog");
  projectToDelete = name;
  dialog.showModal();
}

function displayDeleteMessage(message, type) {
  let element = document.getElementById("delete-message");
  element.classList.remove("message-error");
  element.classList.remove("message-success");
  if (type && type === "success") {
    element.classList.add("message-success");
  } else if (type && type === "error") {
    element.classList.add("message-error");
  }
  element.innerText = message;
}

function deleteSelectedProject() {
  if (!projectToDelete) {
    return;
  }
  let deletePasswordField = document.getElementById("delete-pass");
  let password = deletePasswordField.value;
  fetch("/api/project", {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: projectToDelete,
      password: password,
    }),
  })
    .then((response) => response.json())
    .then((json) => {
      if (json.status && json.status === "error") {
        displayDeleteMessage(json.message, "error");
      }
      if (json.status && json.status === "success") {
        displayDeleteMessage(json.message, "success");
        setTimeout(() => {
          location.reload();
        }, 1000);
      }
    });
}
