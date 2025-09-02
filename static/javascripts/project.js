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
  element.classList.remove("message-info");
  if (type && type === "success") {
    element.classList.add("message-success");
  } else if (type && type === "error") {
    element.classList.add("message-error");
  }
  element.innerText = message;
}

async function deleteSelectedProject() {
  if (!projectToDelete) {
    return;
  }
  let deletePasswordField = document.getElementById("delete-pass");
  let password = deletePasswordField.value;
  try {
    const response = await fetch("/api/project", {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-csrf-token": getCSRFToken(),
      },
      body: JSON.stringify({
        name: projectToDelete,
        password: password,
      }),
    });
    if (response.ok) {
      const json = await response.json();
      displayDeleteMessage(json.message, "success");
      setTimeout(() => {
        location.reload();
      }, 2000);
    } else {
      const json = await response.json();
      if (json && json.message) {
        displayDeleteMessage(json.message, "error");
      }
    }
  } catch (error) {
    console.error(error);
    displayDeleteMessage("Fehler beim Senden der Anfrage.");
  }
}
