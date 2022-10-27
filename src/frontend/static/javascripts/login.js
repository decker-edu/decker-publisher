function openLoginDialog() {
  let dialog = document.getElementById("login-dialog");
  dialog.showModal();
}

function closeLoginDialog() {
  let dialog = document.getElementById("login-dialog");
  dialog.close();
}

function openUserDialog() {
  let dialog = document.getElementById("user-dialog");
  dialog.showModal();
}

function closeUserDialog() {
  let dialog = document.getElementById("user-dialog");
  dialog.close();
}

function displayUserDialogMessage(message, type) {
  let element = document.getElementById("user-message");
  element.classList.remove("message-error");
  element.classList.remove("message-success");
  if (type && type === "success") {
    element.classList.add("message-success");
  } else if (type && type === "error") {
    element.classList.add("message-error");
  }
  element.innerText = message;
}

function displayLoginDialogMessage(message, type) {
  let element = document.getElementById("login-message");
  element.classList.remove("message-error");
  element.classList.remove("message-success");
  if (type && type === "success") {
    element.classList.add("message-success");
  } else if (type && type === "error") {
    element.classList.add("message-error");
  }
  element.innerText = message;
}

function asyncLogin() {
  let userElement = document.getElementById("login-user");
  let passElement = document.getElementById("login-pass");
  let username = userElement.value;
  let password = passElement.value;
  fetch("/api/login", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: username,
      password: password,
    }),
  })
    .then((response) => {
      return response.json();
    })
    .then((json) => {
      if (json.status === "success") {
        displayLoginDialogMessage(json.message, "success");
        setTimeout(() => {
          window.location.replace("/");
        }, 3000);
      } else {
        displayLoginDialogMessage(json.message, "error");
      }
    });
}

function asyncLogout() {
  fetch("/api/logout", {
    method: "POST",
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
        displayUserDialogMessage(json.message, "success");
        setTimeout(() => {
          window.location.replace("/");
        }, 1000);
      } else {
        displayUserDialogMessage(json.message, "error");
      }
    });
}

let loginDialog = document.getElementById("login-dialog");
if (loginDialog) {
  loginDialog.addEventListener("keypress", (event) => {
    let usernameField = document.getElementById("login-user");
    let passwordField = document.getElementById("login-pass");
    if (event.key === "Enter") {
      event.preventDefault();
      if (document.activeElement && document.activeElement === usernameField) {
        passwordField.focus();
        return;
      }
      if (document.activeElement && document.activeElement === passwordField) {
        asyncLogin();
        return;
      }
    }
  });
}
