function addUpload() {
  const div = document.getElementById("insert-area");
  const template = document.getElementById("upload-template");
  const insert = template.content.cloneNode(true);
  while (div.firstChild) {
    div.removeChild(div.lastChild);
  }
  div.appendChild(insert);
}

function inputChanged() {
  const input = document.getElementById("file-upload-input");
  if (input.value) {
    let filename = input.value.split(/(\/|\\)/g).pop();
    if (filename) {
      const label = document.getElementById("file-upload-label");
      label.innerText = filename;
      const button = document.getElementById("file-upload-button");
      button.removeAttribute("hidden");
      const configDiv = document.getElementById("project-config");
      configDiv.classList.remove("hidden");
      const nameInput = document.getElementById("project-name-input");
      nameInput.value = filename.split(".")[0];
    }
  }
}

function passOn(event) {
  const input = document.getElementById("file-upload-input");
  input.click();
}

function upload() {
  const input = document.querySelector("#file-upload-input");
  const projectName = document.querySelector("#project-name-input");
  const data = new FormData();
  data.append("file", input.files[0]);
  data.append("projectName", projectName.value);
  const request = new Request("/api/project", {
    method: "POST",
    body: data,
  });
  fetch(request)
    .then((response) => {
      return response.json();
    })
    .then((json) => {
      const div = document.getElementById("insert-area");
      while (div.firstChild) {
        div.removeChild(div.lastChild);
      }
      div.appendChild(document.createTextNode(json.message));
    })
    .catch((error) => {
      const div = document.getElementById("insert-area");
      while (div.firstChild) {
        div.removeChild(div.lastChild);
      }
      div.appendChild(document.createTextNode("Interner Fehler"));
    });
}
