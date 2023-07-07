let selectedKey;

function openRemoveKeyDialog(key) {
  const deleteDialog = document.getElementById("remove-ssh-key-dialog");
  const deleteArea = document.getElementById("remove-ssh-key-textarea");
  deleteArea.value = key;
  selectedKey = key;
  deleteDialog.showModal();
}

function passwordChanged() {
  const pw1Input = document.getElementById("change-password-new");
  const pw2Input = document.getElementById("change-password-new-repeat");
  const button = document.getElementById("change-password-button");
  if (
    pw1Input.value === "" ||
    pw2Input.value === "" ||
    pw1Input.value !== pw2Input.value ||
    !pw1Input.checkValidity() ||
    !pw2Input.checkValidity()
  ) {
    button.disabled = true;
  } else {
    button.disabled = false;
  }
}

function emailChanged() {
  const mailInput = document.getElementById("change-email-input");
  const passwordInput = document.getElementById("change-email-confirmation");
  const button = document.getElementById("change-email-button");
  if (!mailInput.checkValidity() || !passwordInput.checkValidity()) {
    button.disabled = true;
  } else {
    button.disabled = false;
  }
}

function sshkeyChanged() {
  const form = document.getElementById("add-ssh-key-form");
  const button = document.getElementById("add-ssh-key-button");
  if (!form.checkValidity()) {
    button.disabled = true;
    return false;
  } else {
    button.disabled = false;
    return true;
  }
}

function deleteChanged() {
  const form = document.getElementById("remove-ssh-key-form");
  const button = document.getElementById("remove-ssh-key-button");
  if (!form.checkValidity()) {
    button.disabled = true;
    return false;
  } else {
    button.disabled = false;
    return true;
  }
}

async function changePassword(username) {
  const oldInput = document.getElementById("change-password-old");
  const newInput = document.getElementById("change-password-new");
  let response;
  try {
    response = await fetch(`/api/user/${username}/password`, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        oldPassword: oldInput.value,
        newPassword: newInput.value,
      }),
    });
  } catch (error) {
    displayMessage(
      `Es ist ein Fehler während der Datenübertragung aufgetreten.`
    );
    console.error(error);
    return;
  }
  try {
    if (response && response.ok) {
      const json = await response.json();
      if (json.message) {
        displayMessage(json.message);
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        displayMessage("Anfrage erfolgreich übermittelt.");
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } else {
      const json = await response.json();
      if (json.message) {
        displayMessage(json.message);
      } else {
        displayMessage("Der Server meldet einen unbekannten Fehler.");
      }
    }
  } catch (error) {
    console.error(error);
    displayMessage("Fehler beim Bearbeiten der Antwort.");
  }
}

async function changeEmail(username) {
  const newInput = document.getElementById("change-email-input");
  const passwordInput = document.getElementById("change-email-confirmation");
  let response;
  try {
    response = await fetch(`/api/user/${username}/email`, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        passwordConfirmation: passwordInput.value,
        newEmail: newInput.value,
      }),
    });
  } catch (error) {
    displayMessage(
      `Es ist ein Fehler während der Datenübertragung aufgetreten.`
    );
    console.error(error);
    return;
  }
  try {
    if (response && response.ok) {
      const json = await response.json();
      if (json.message) {
        displayMessage(json.message);
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        displayMessage("Anfrage erfolgreich übermittelt.");
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } else {
      const json = await response.json();
      if (json.message) {
        displayMessage(json.message);
      } else {
        displayMessage("Der Server meldet einen unbekannten Fehler.");
      }
    }
  } catch (error) {
    console.error(error);
    displayMessage("Fehler beim bearbeiten der Antwort.");
  }
}

function addKey(username) {
  const textarea = document.getElementById("add-ssh-key-textarea");
  const passwordInput = document.getElementById("add-ssh-key-confirmation");
  fetch(`/api/user/${username}/sshkey`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      passwordConfirmation: passwordInput.value,
      newKey: textarea.value,
    }),
  })
    .then((response) => {
      if (response.ok) {
        displayMessage("Schlüssel übernommen.");
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        response.json().then((json) => {
          displayMessage(`${response.status}: ${json.message}`);
        });
      }
    })
    .catch((error) => {
      displayMessage(`Ein unerwarteter Fehler ist aufgetreten.`);
      console.error(error);
    });
}

function displayRemovalMessage(message) {
  const text = document.getElementById("remove-ssh-key-message");
  if (text) {
    text.innerText = message;
  } else {
    console.error("Can not find id: remove-ssh-key-message.");
  }
}

function removeKey(username) {
  const textarea = document.getElementById("remove-ssh-key-textarea");
  const passwordInput = document.getElementById("remove-ssh-key-confirmation");
  fetch(`/api/user/${username}/sshkey`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      passwordConfirmation: passwordInput.value,
      delKey: textarea.value,
    }),
  })
    .then((response) => {
      if (response.ok) {
        displayRemovalMessage("Schlüssel gelöscht.");
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        response.json().then((json) => {
          displayRemovalMessage(`${response.status}: ${json.message}`);
        });
      }
    })
    .catch((error) => {
      displayRemovalMessage(`Ein unerwarteter Fehler ist aufgetreten.`);
      console.error(error);
    });
}

function deleteAccount(username) {
  const passwordInput = document.getElementById("delete-account-confirmation");
  fetch(`/api/user/${username}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      passwordConfirmation: passwordInput.value,
    }),
  })
    .then((response) => {
      if (response.ok) {
        response.json().then((json) => {
          displayMessage(json.message);
          setTimeout(() => {
            window.location.replace("/");
          }, 1000);
        });
      } else {
        response.json().then((json) => {
          displayMessage(`${response.status}: ${json.message}`);
        });
      }
    })
    .catch((error) => {
      displayMessage(`Ein unerwarteter Fehler ist aufgetreten.`);
      console.error(error);
    });
}
