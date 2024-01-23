const registerPasswordField = document.getElementById("register-password");
const registerRepeatField = document.getElementById("register-repeat-password");
const registerButton = document.getElementById("register-button");
registerPasswordField.addEventListener("keyup", onPasswordChanged);
registerRepeatField.addEventListener("keyup", onPasswordChanged);

function togglePasswordVisibility(event) {
  registerPasswordField.type =
    registerPasswordField.type === "password" ? "test" : "password";
  if (registerPasswordField.type === "password") {
    event.currentTarget.classList.remove("show");
  } else {
    event.currentTarget.classList.add("show");
  }
}

function toggleRepeatVisibility(event) {
  registerRepeatField.type =
    registerRepeatField.type === "password" ? "test" : "password";
  if (registerRepeatField.type === "password") {
    event.currentTarget.classList.remove("show");
  } else {
    event.currentTarget.classList.add("show");
  }
}

function onPasswordChanged() {
  let firstPassword = registerPasswordField.value;
  let secondPassword = registerRepeatField.value;
  if (
    firstPassword === "" ||
    secondPassword === "" ||
    firstPassword !== secondPassword
  ) {
    registerButton.disabled = true;
  } else {
    registerButton.disabled = false;
  }
}

function displayRegisterMessage(message, type) {
  let element = document.getElementById("register-message");
  element.classList.remove("message-error");
  element.classList.remove("message-success");
  if (type && type === "success") {
    element.classList.add("message-success");
  } else if (type && type === "error") {
    element.classList.add("message-error");
  }
  element.innerText = message;
}

async function postRegister() {
  let username = document.getElementById("register-username").value;
  let password = document.getElementById("register-password").value;
  let email = document.getElementById("register-email").value;
  let token = document.getElementById("register-token").value;
  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        registerUsername: username,
        registerPassword: password,
        registerEmail: email,
        registerToken: token,
      }),
    });
    if (response.ok) {
      const json = await response.json();
      displayRegisterMessage(json.message, "success");
      setTimeout(() => window.location.replace("/"), 2000);
    } else {
      const json = await response.json();
      displayRegisterMessage(json.message, "error");
    }
  } catch (error) {
    console.error(error);
    displayRegisterMessage("Fehler beim Senden der Anfrage.", "error");
  }
}
