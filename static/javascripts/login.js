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

async function login() {
  const userElement = document.getElementById("login-user");
  const passElement = document.getElementById("login-pass");
  const username = userElement.value;
  const password = passElement.value;
  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: username,
        password: password,
      }),
    });
    if (response.ok) {
      const json = await response.json();
      displayLoginDialogMessage(json.message, "success");
      setTimeout(() => {
        window.location.replace("/");
      }, 1000);
    } else {
      const json = await response.json();
      displayLoginDialogMessage(json.message, "error");
    }
  } catch (error) {
    if (error.message) {
      displayLoginDialogMessage(error.message, "error");
    }
  }
}

async function logout() {
  try {
    const response = await fetch("/api/logout", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
    if (response.ok) {
      const json = await response.json();
      displayUserDialogMessage(json.message, "success");
      setTimeout(() => {
        window.location.replace("/");
      }, 1000);
    } else {
      const json = await response.json();
      displayUserDialogMessage(json.message, "error");
    }
  } catch (error) {
    if (error.message) {
      displayUserDialogMessage(error.message, "error");
    }
  }
}

window.addEventListener("load", (event) => {
  let loginButton = document.getElementById("login-button");
  if (loginButton) {
    loginButton.addEventListener("click", (event) => {
      event.preventDefault();
      login();
    });
  }

  let loginDialog = document.getElementById("login-dialog");
  if (loginDialog) {
    loginDialog.addEventListener("close", (event) => {
      const buttonName = loginDialog.returnValue;
      if (buttonName === "login-button") {
        login();
        event.preventDefault();
      }
    });
    loginDialog.addEventListener("keypress", (event) => {
      let usernameField = document.getElementById("login-user");
      let passwordField = document.getElementById("login-pass");
      if (event.key === "Enter") {
        event.preventDefault();
        if (
          document.activeElement &&
          document.activeElement === usernameField
        ) {
          passwordField.focus();
          return;
        }
        if (
          document.activeElement &&
          document.activeElement === passwordField
        ) {
          login();
          return;
        }
      }
    });
  }
});
