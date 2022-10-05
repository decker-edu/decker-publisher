let registerPasswordField = document.getElementById("register-password");
let registerRepeatField = document.getElementById("register-repeat-password");
let registerButton = document.getElementById("register-button");
registerPasswordField.addEventListener("change", onPasswordChanged);
registerRepeatField.addEventListener("change", onPasswordChanged);

function onPasswordChanged() {
  let firstPassword = registerPasswordField.value;
  let secondPassword = registerRepeatField.value;
  if (firstPassword !== secondPassword) {
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

function asyncRegister() {
  let username = document.getElementById("register-username").value;
  let password = document.getElementById("register-password").value;
  let email = document.getElementById("register-email").value;
  let token = document.getElementById("register-token").value;
  fetch("/api/register", {
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
  })
    .then((response) => {
      return response.json();
    })
    .then((json) => {
      if (json.status === "success") {
        displayRegisterMessage(json.message, "success");
        window.location.replace("/");
      } else {
        displayRegisterMessage(json.message, "error");
      }
    });
}
