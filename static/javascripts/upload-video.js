function addVideoUpload() {
  const div = document.getElementById("insert-area");
  const template = document.getElementById("video-upload-template");
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
    }
  }
}

function passOn(event) {
  const input = document.getElementById("file-upload-input");
  input.click();
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
  const div = document.getElementById("insert-area");
  clearElement(div);
  div.appendChild(document.createTextNode("Datei erfolgreich hochgeladen."));
  setTimeout(() => window.location.reload(), 2000);
}

function uploadVideo() {
  const input = document.querySelector("#file-upload-input");
  const data = new FormData();
  data.append("file", input.files[0]);
  const xhr = new XMLHttpRequest();
  xhr.upload.addEventListener("progress", updateProgress);
  xhr.addEventListener("loadstart", initProgress);
  xhr.addEventListener("loadend", endProgress);
  xhr.open("POST", "/api/video");
  xhr.send(data);
}

let username;

function clearElement(element) {
  while (element.firstChild) {
    element.removeChild(element.lastChild);
  }
}

async function getVideoList() {
  try {
    const response = await fetch(`/api/user/${username}/videos`);
    if (response.ok) {
      const json = await response.json();
      if (json.videos) {
        const tbody = document.getElementById("video-table-body");
        clearElement(tbody);
        for (const video of json.videos) {
          const tr = document.createElement("tr");
          const td = document.createElement("td");
          tr.appendChild(td);
          const link = document.createElement("a");
          link.classList.add("action");
          link.href = "/video?filepath=" + video;
          const icon = document.createElement("i");
          icon.classList.add("fas");
          icon.classList.add("fa-film");
          const span = document.createElement("span");
          span.innerText = video;
          link.appendChild(icon);
          link.appendChild(span);
          td.appendChild(link);
          tbody.appendChild(tr);
        }
      }
    }
  } catch (error) {
    console.error(error);
  }
}

window.addEventListener("load", (event) => {
  username = document.getElementById("navigation-username").innerText;
  getVideoList();
});
