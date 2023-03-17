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

function clearInsertArea() {
  const div = document.getElementById("insert-area");
  while (div.firstChild) {
    div.removeChild(div.lastChild);
  }
}

function initProgress(event) {
  clearInsertArea();
  const div = document.getElementById("insert-area");
  const bar = document.createElement("progress");
  bar.id = "upload-progress";
  bar.value = 0;
  bar.max = 100;
  bar.innerText = "Upload gestartet.";
  div.appendChild(bar);
  updateProgress(event);
}

function updateProgress(event) {
  const total = event.total;
  const loaded = event.loaded;
  if (event.lengthComputable) {
    const part = (loaded / total) * 100;
    const bar = document.getElementById("upload-progress");
    if (bar) {
      bar.value = part;
      bar.innerText = part;
    }
  } else {
    const bar = document.getElementById("upload-progress");
    if (bar && loaded) {
      bar.value = loaded;
      bar.innerHTML = loaded + " bytes";
    }
  }
}

function endProgress(event) {
  //  clearInsertArea();
  const div = document.getElementById("insert-area");
  div.appendChild(document.createTextNode("Datei erfolgreich hochgeladen."));
}

function upload() {
  const input = document.querySelector("#file-upload-input");
  const projectName = document.querySelector("#project-name-input");
  const data = new FormData();
  data.append("file", input.files[0]);
  data.append("projectName", projectName.value);
  const xhr = new XMLHttpRequest();
  xhr.addEventListener("progress", updateProgress);
  xhr.addEventListener("loadstart", initProgress);
  xhr.addEventListener("loadend", endProgress);
  xhr.open("POST", "/api/project");
  xhr.send(data);
}
