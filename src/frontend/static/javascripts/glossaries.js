async function deleteGlossary(id) {
  try {
    const passwordConfirmation = document.getElementById("delete-pass");
    const response = await fetch("/api/amberscript/glossary/" + id, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        passwordConfirmation: passwordConfirmation.value,
      }),
    });
    if (response.ok) {
      window.location.reload();
    } else {
      const json = await response.json();
      displayMessage(json.message);
    }
  } catch (error) {
    displayMessage(error);
  }
}

let selectedGlossary;

function selectForDeletion(button) {
  selectedGlossary = button.dataset.glossary;
  openDialog("delete-dialog");
}
