const supportsFileSystemAccessAPI =
  "getAsFileSystemHandle" in DataTransferItem.prototype;
const supportsWebkitGetAsEntry =
  "webkitGetAsEntry" in DataTransferItem.prototype;

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
      configDiv.removeAttribute("hidden");
      const nameInput = document.getElementById("project-name-input");
      nameInput.value = filename.split(".")[0];
    }
  }
}

function passOn(event) {
  const input = document.getElementById("file-upload-input");
  if (event.key === "Enter" || event.key === " ") input.click();
}

function clearInsertArea() {
  const div = document.getElementById("upload-area");
  while (div.firstChild) {
    div.removeChild(div.lastChild);
  }
}

function initProgress(event) {
  clearInsertArea();
  const div = document.getElementById("upload-area");
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
  const div = document.getElementById("upload-area");
  div.appendChild(document.createTextNode("Upload beendet."));
  setTimeout(() => window.location.reload(), 2000);
}

function upload() {
  const input = document.querySelector("#file-upload-input");
  const projectName = document.querySelector("#project-name-input");
  const data = new FormData();
  data.append("file", input.files[0]);
  data.append("projectName", projectName.value);
  const xhr = new XMLHttpRequest();
  xhr.responseType = "json";
  xhr.upload.addEventListener("progress", updateProgress);
  xhr.addEventListener("loadstart", initProgress);
  xhr.addEventListener("loadend", endProgress);
  xhr.addEventListener("load", (event) => {
    const json = xhr.response;
    const status = xhr.status;
    if (json) {
      const div = document.getElementById("upload-area");
      const message = json.message;
      if (message) {
        div.appendChild(document.createTextNode(`${status}: ${message}`));
      } else {
        div.appendChild(document.createTextNode(`${status}: Upload beendet.`));
      }
    }
    if (status === 200) {
      setTimeout(() => window.location.reload(), 2000);
    }
  });
  xhr.open("POST", "/api/project");
  xhr.send(data);
}

function setEmptyProjectMessage(message) {
  const div = document.getElementById("empty-project-message-area");
  const span = document.createElement("span");
  span.innerText = message;
  while (div.lastElementChild) {
    div.removeChild(div.lastElementChild);
  }
  div.appendChild(span);
}

async function createEmptyProject() {
  const projectNameInput = document.querySelector("#empty-project-name-input");
  try {
    const response = await fetch("/api/project/empty", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectName: projectNameInput.value,
      }),
    });
    if (response.ok) {
      const json = await response.json();
      let message = "Anfrage erfolgreich gesendet.";
      if (json.message) {
        message = json.message;
      }
      setEmptyProjectMessage(message);
      setTimeout(() => window.location.reload(), 2000);
    } else {
      const json = await response.json();
      let message = "Anfrage wurde abgelehnt.";
      if (json.message) {
        message = json.message;
      }
      setEmptyProjectMessage(message);
    }
  } catch (error) {
    console.error(error);
    setEmptyProjectMessage("Fehler beim Senden der Anfrage.");
  }
}

let enterCounter = 0;

function dragEnterHandler(event) {
  if (enterCounter === 0) {
    event.currentTarget.classList.add("dragover");
  }
  enterCounter++;
}

function dragLeaveHandler(event) {
  enterCounter--;
  if (enterCounter === 0) {
    event.currentTarget.classList.remove("dragover");
  }
}

function dragOverHandler(event) {
  event.preventDefault();
}

uploadFiles = undefined;

async function readDirectories(handle, root) {
  if (handle.kind === "directory") {
    for await (const [key, value] of handle.entries()) {
      await readDirectories(value, root + "/" + handle.name);
    }
  } else {
    uploadFiles.push({
      path: root + "/" + handle.name,
      file: await handle.getFile(),
    });
  }
}

async function promiseEntries(reader) {
  return new Promise((resolve, reject) => {
    reader.readEntries(
      (entries) => {
        resolve(entries);
      },
      (error) => {
        reject(error);
      }
    );
  });
}

async function promiseFile(filehandle) {
  return new Promise((resolve, reject) => {
    filehandle.file(
      (file) => {
        resolve(file);
      },
      (error) => {
        reject(error);
      }
    );
  });
}

async function readWebkitDirectories(handle, root) {
  return new Promise(async (resolve, reject) => {
    if (handle.isDirectory) {
      const reader = handle.createReader();
      const entries = await promiseEntries(reader);
      for (const entry of entries) {
        await readWebkitDirectories(entry, root + "/" + handle.name);
      }
    } else {
      const file = await promiseFile(handle);
      uploadFiles.push({
        path: root + "/" + handle.name,
        file: file,
      });
    }
    resolve();
  });
}

async function dropHandler(event) {
  enterCounter = 0;
  event.currentTarget.classList.remove("dragover");
  event.preventDefault();
  if (!supportsFileSystemAccessAPI && !supportsWebkitGetAsEntry) {
    return;
  }
  if (event.dataTransfer.items) {
    for (const item of event.dataTransfer.items) {
      if (item.kind === "file") {
        let handle = undefined;
        if (supportsFileSystemAccessAPI) {
          handle = await item.getAsFileSystemHandle();
          if (handle) {
            uploadFiles = [];
            for await (const [key, value] of handle.entries()) {
              await readDirectories(value, "");
            }
          }
        } else {
          handle = await item.webkitGetAsEntry();
          if (handle) {
            uploadFiles = [];
            const reader = handle.createReader();
            const entries = await promiseEntries(reader);
            for (const entry of entries) {
              await readWebkitDirectories(entry, "");
            }
          }
        }
        const area = document.getElementById("upload-area");
        while (area.firstChild) {
          area.removeChild(area.lastChild);
        }
        const span = document.createElement("span");
        span.innerText =
          uploadFiles.length + " Dateien zum hochladen ausgewählt.";
        area.appendChild(span);
        document
          .getElementById("upload-directory-button")
          .removeAttribute("hidden");
        document.getElementById("project-config").removeAttribute("hidden");
      }
    }
  }
}

function uploadDirectory() {
  const data = new FormData();
  for (const file of uploadFiles) {
    data.append("directory", file.file, encodeURIComponent(file.file.name));
    data.append("paths", file.path);
  }
  const nameInput = document.getElementById("project-name-input");
  data.append("projectName", nameInput.value);
  const xhr = new XMLHttpRequest();
  xhr.upload.addEventListener("progress", updateProgress);
  xhr.addEventListener("loadstart", initProgress);
  xhr.addEventListener("loadend", endProgress);
  xhr.open("POST", "/api/project/directory");
  xhr.send(data);
}

window.addEventListener("load", (event) => {
  const uploadArea = document.getElementById("upload-area");
  uploadArea.addEventListener("dragenter", dragEnterHandler);
  uploadArea.addEventListener("dragleave", dragLeaveHandler);
  uploadArea.addEventListener("dragover", dragOverHandler);
  uploadArea.addEventListener("drop", dropHandler);
});
