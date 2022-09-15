function openDeleteProjectDialog(name) {
  let dialog = document.getElementById("delete-dialog");

  dialog.showModal();
}

function deleteProject(name) {
  fetch("/api/project", {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: name,
    }),
  })
    .then((response) => response.json())
    .then((json) => {
      if (json.status && json.status === "success") {
        window.location.replace("/home");
      }
    });
}
