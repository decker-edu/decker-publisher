let featureAvailable = true;
if (
  !window.showDirectoryPicker ||
  typeof window.showDirectoryPicker !== "function"
) {
  featureAvailable = false;
  displayChromeRequired();
}

const locationParts = window.location.href.split("/");

const project = locationParts[locationParts.length - 1];

const username = locationParts[locationParts.length - 2];

async function fetchProjectData() {
  const response = await fetch(`/api/project/${username}/${project}/files`);
  if (response.ok) {
    const json = await response.json();
    serverData = json;
    appendData(json, document.getElementById("server-table"));
  } else {
    const json = await response.json();
    const message = json.message;
    displayError(message);
  }
}

function setAccessMessage(message) {
  const span = document.getElementById("access-message");
  if (span) {
    span.innerText = message;
  }
}

async function fetchHtpasswd() {
  const response = await fetch(`/api/project/${username}/${project}/access`);
  if (response.ok) {
    const json = await response.json();
    const htuser = json.htuser;
    document.getElementById("access-username").value = htuser;
    setAccessMessage(
      `Es ist Zugriff für externe Nutzer über den Nutzernamen '${htuser}' konfiguriert.`
    );
  } else {
    if (response.status === 404) {
      setAccessMessage("Es ist kein Zugriff für externe Nutzer konfiguriert.");
      return;
    } else {
      try {
        const json = await response.json();
        const msg = json.message;
        console.error(msg);
      } catch (error) {
        console.error(error);
      }
    }
  }
}

async function deleteHtpasswd() {
  const response = await fetch(`/api/project/${username}/${project}/access`, {
    method: "DELETE",
  });
  if (response.ok) {
    setAccessMessage("Zugriffsdaten erfolgreich gelöscht.");
  } else {
    try {
      const json = await response.json();
      if (json.message) {
        setAccessMessage(
          `Fehler beim löschen der Zugriffsdaten: ${json.message}`
        );
      } else {
        setAccessMessage("Fehler beim löschen der Zugriffsdaten.");
      }
    } catch (error) {
      setAccessMessage("Unbekannter Fehler beim löschen der Zugriffsdaten.");
      console.error(error);
    }
  }
}

async function setHtpasswd() {
  const htuser = document.getElementById("access-username").value;
  const htpass = document.getElementById("access-password").value;
  const response = await fetch(`/api/project/${username}/${project}/access`, {
    method: "POST",
    cache: "no-cache",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ htuser: htuser, htpass: htpass }),
  });
  if (response.ok) {
    setAccessMessage(`Neue Zugriffsdaten mit Nutzer '${htuser}' gesetzt.`);
    return;
  } else {
    try {
      const json = await response.json();
      if (json.message) {
        setAccessMessage(
          `Fehler beim setzen der Zugriffsdaten: ${json.message}`
        );
      } else {
        setAccessMessage("Unbekannter Fehler beim setzen der Zugriffsdaten.");
      }
    } catch (error) {
      console.error(error);
      setAccessMessage("Unbekannter Fehler beim setzen der Zugriffsdaten.");
    }
  }
}

function clearProgressArea() {
  const area = document.getElementById("progress-area");
  while (area.firstChild) {
    area.removeChild(area.lastChild);
  }
}

function displayChromeRequired() {
  const main = document.getElementById("sync-controls");
  while (main.firstChild) {
    main.removeChild(main.lastChild);
  }
  const div = document.createElement("div");
  const span = document.createElement("span");
  div.appendChild(span);
  main.appendChild(div);
  const i = document.createElement("i");
  i.classList.add("fa-brands");
  i.classList.add("fa-chrome");
  i.style.fontSize = "4rem";
  span.textContent =
    "Diese Funktion wird von diesem Browser nicht unterstützt.";
  const text = document.createElement("p");
  main.appendChild(i);
  main.appendChild(text);
  main.classList.add("centered");
  text.innerText = "Bitte benutzen Sie einen auf Chrome basierenden Browser.";
}

function toggleCaret(event) {
  if (event.target === event.currentTarget) {
    event.target.classList.toggle("active");
  }
}

function displayError(message) {
  const span = document.getElementById("error-message");
  span.innerText = message;
}

function requestDirectoryAccess() {
  if (!featureAvailable) return;
  chooseDirectory().then(() => {});
}

function clearElement(element) {
  while (element.firstChild) {
    element.removeChild(element.lastChild);
  }
}

async function appendData(dataset, list) {
  for (const item of dataset) {
    if (item.kind === "file") {
      const listitem = document.createElement("li");
      listitem.classList.add("file-item");
      listitem.innerText = item.filename;
      listitem.title = new Date(item.modified);
      item.reference = listitem;
      list.appendChild(listitem);
    } else if (item.kind === "directory") {
      const listitem = document.createElement("li");
      const innerlist = document.createElement("ul");
      listitem.addEventListener("click", toggleCaret);
      listitem.classList.add("directory-item");
      listitem.classList.add("caret");
      listitem.innerText = item.filename;
      listitem.appendChild(innerlist);
      item.reference = listitem;
      list.appendChild(listitem);
      appendData(item.children, innerlist);
    }
  }
}

let clientRootHandle;
let publicDirHandle;

async function fetchFile(filepath) {
  clearProgressArea();
  const info = document.createElement("p");
  info.innerText = "Lade herunter: " + filepath;
  document.getElementById("progress-area").appendChild(info);
  try {
    const response = await fetch(
      `/api/project/${username}/${project}/files/${filepath}`
    );
    if (response && response.ok) {
      clearProgressArea();
      return response.arrayBuffer();
    } else {
      const json = await response.json();
      console.error(response.status, json.message);
      return null;
    }
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function readClientData() {
  const checksums = await accumulateFileInformation(
    publicDirHandle.entries(),
    ""
  );
  clientData = checksums;
  const clientList = document.getElementById("client-table");
  await appendData(checksums, clientList);
}

async function chooseDirectory() {
  window.showDirectoryPicker({ mode: "readwrite" }).then(async (handle) => {
    if (!handle) {
      displayError("Kein Ordner ausgewählt.");
    }
    clearElement(document.getElementById("client-table"));
    const entries = handle.entries();
    let hasDeckerYaml = false;
    let hasPublicDir = false;
    for await (const [path, entry] of entries) {
      if (entry.kind === "file" && path === "decker.yaml") {
        hasDeckerYaml = true;
      }
      if (entry.kind === "directory" && path === "public") {
        publicDirHandle = entry;
        hasPublicDir = true;
      }
    }
    if (!hasDeckerYaml || !hasPublicDir) {
      displayError("Das gewählte Verzeichnis ist kein Projektverzeichnis.");
      return;
    }
    clientRootHandle = handle;
    await readClientData();
    compareData();
    document.getElementById("upload-button").disabled = false;
    document.getElementById("download-button").disabled = false;
  });
}

async function pushFile(filepath, file) {
  function initProgress(event) {
    clearProgressArea();
    const div = document.getElementById("progress-area");
    const msg = document.createElement("p");
    msg.innerText = `Übertrage: ${filepath}`;
    div.appendChild(msg);
    const bar = document.createElement("progress");
    bar.id = "upload-progress";
    bar.value = 0;
    bar.max = 100;
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
    clearProgressArea();
    const div = document.getElementById("progress-area");
    const msg = document.createElement("p");
    msg.innerText = `Übertragung von ${filepath} abgeschlossen!`;
    div.appendChild(msg);
  }

  const data = new FormData();
  data.append("file", file);
  const xhr = new XMLHttpRequest();
  function finallizeProgress(event) {
    if (xhr.readyState === 4 && xhr.status === 200) {
      `Übertragung von ${filepath} erfolgreich!`;
    } else {
      if (xhr.responseType === "json") {
        const error = JSON.parse(xhr.responseText);
        if (error.message) {
          console.error(error.message);
        }
      }
    }
  }
  xhr.upload.addEventListener("progress", updateProgress);
  xhr.addEventListener("loadstart", initProgress);
  xhr.addEventListener("loadend", endProgress);
  xhr.addEventListener("readystatechange", finallizeProgress);
  xhr.open("POST", `/api/project/${username}/${project}/files/${filepath}`);
  xhr.send(data);
}

async function accumulateFileInformation(entries, rootPath) {
  const data = [];
  for await (const [key, value] of entries) {
    const path = rootPath + key;
    if (value.kind === "file") {
      const file = await value.getFile();
      const lastModified = file.lastModified;
      const buffer = await file.arrayBuffer();
      const hash = await crypto.subtle.digest("SHA-256", buffer);
      const array = Array.from(new Uint8Array(hash));
      const hex = array.map((b) => b.toString(16).padStart(2, "0")).join("");
      data.push({
        kind: "file",
        filename: key,
        filepath: path,
        modified: lastModified,
        checksum: hex,
        children: null,
      });
    } else if (value.kind === "directory") {
      const recursion = await accumulateFileInformation(
        value.entries(),
        path + "/"
      );
      data.push({
        kind: "directory",
        filename: key,
        filepath: path,
        modified: null,
        checksum: null,
        children: recursion,
      });
    }
  }
  return data;
}

let serverData;
let clientData;

let toUpload;
let toDownload;

function isGeneratedFile(filename) {
  const regex =
    /.+(-recording.webm|-recording.mp4|-recording.vtt|-recording.mp4.list|-annot.json|-recording-[0-9]+.webm|-times.json)$/;
  return regex.test(filename);
}

async function confirmDownload() {
  const dialog = document.getElementById("confirm-download");
  const list = document.getElementById("download-list");
  const dlbutton = document.getElementById("dialog-download-button");
  dlbutton.removeAttribute("disabled");
  while (list.firstChild) {
    list.removeChild(list.lastChild);
  }
  const genFiles = [];
  for (const entry of toDownload) {
    if (isGeneratedFile(entry.filename)) {
      genFiles.push(entry.filename);
    }
  }
  if (genFiles.length === 0) {
    const legend = document.getElementById("download-legend");
    legend.innerText =
      "Es befinden sich auf dem Server keine Dateien, die sie herunterladen müssen.";
    dlbutton.setAttribute("disabled", "");
  } else {
    for (const filename of genFiles) {
      const li = document.createElement("li");
      li.innerText = filename;
      list.appendChild(li);
    }
  }
  dialog.showModal();
}

async function download() {
  const dialog = document.getElementById("confirm-download");
  if (dialog) {
    dialog.close();
  }
  try {
    for (const entry of toDownload) {
      let targetDir = clientRootHandle;
      if (isGeneratedFile(entry.filename)) {
        console.log(entry.filepath.split("/"));
        const buffer = await fetchFile(entry.filepath);
        if (!buffer) {
          continue;
        }
        const parts = entry.filepath.split("/");
        while (parts.length > 1) {
          const dir = parts.shift();
          targetDir = await targetDir.getDirectoryHandle(dir, { create: true });
        }
        const file = await targetDir.getFileHandle(parts[0], { create: true });
        const writable = await file.createWritable();
        await writable.write(buffer);
        await writable.close();
      }
    }
    clearProgressArea();
    const area = document.getElementById("progress-area");
    const msg = document.createElement("p");
    msg.innerText = "Downloads abgeschlossen!";
    area.appendChild(msg);
    clearElement(document.getElementById("client-table"));
    await readClientData();
    compareData();
  } catch (error) {
    console.error(error);
  }
}

function confirmUpload() {
  const dialog = document.getElementById("confirm-upload");
  dialog.showModal();
}

async function upload() {
  const delOnUpload = document.getElementById("delete-on-upload");
  const shouldDelete = delOnUpload ? delOnUpload.checked : false;
  const dialog = document.getElementById("confirm-upload");
  dialog.close();
  if (shouldDelete) {
    await deleteOnlyServer();
  }
  for (const entry of toUpload) {
    try {
      let targetDir = await clientRootHandle.getDirectoryHandle("public");
      const parts = entry.filepath.split("/");
      while (parts.length > 1) {
        const dir = parts.shift();
        targetDir = await targetDir.getDirectoryHandle(dir);
      }
      const handle = await targetDir.getFileHandle(parts[0]);
      const file = await handle.getFile();
      if (file) {
        await pushFile(entry.filepath, file);
      }
      entry.reference.classList.add("handled");
    } catch (error) {
      console.error(error);
    }
  }
  clearElement(document.getElementById("server-table"));
  clearElement(document.getElementById("client-table"));
  await readClientData();
  await fetchProjectData();
  compareData();
}

async function deleteFile(filepath) {
  clearProgressArea();
  const area = document.getElementById("progress-area");
  const msg = document.createElement("p");
  msg.innerText = "Lösche Datei: " + filepath;
  area.appendChild(msg);
  const response = await fetch(
    `/api/project/${username}/${project}/files/${filepath}`,
    {
      method: "DELETE",
    }
  );
  if (response && response.ok) {
    clearProgressArea();
    return;
  } else {
    const status = response.status;
    console.error("deleting file " + filepath + " ended in status: " + status);
  }
}

async function deleteOnlyServer() {
  for (const entry of toDownload) {
    await deleteFile(entry.filepath);
  }
  const area = document.getElementById("progress-area");
  const msg = document.createElement("p");
  msg.innerText = "Dateien gelöscht.";
  area.appendChild(msg);
}

function unfold(tree, list) {
  for (const item of tree) {
    if (item.kind === "directory") {
      unfold(item.children, list);
    } else {
      list.push(item);
    }
  }
}

function compareData() {
  toUpload = [];
  toDownload = [];
  const clientList = [];
  const serverList = [];
  unfold(clientData, clientList);
  unfold(serverData, serverList);
  compareLists(clientList, serverList);
}

function compareLists(clientList, serverList) {
  const handled = new Set();
  for (const a of clientList) {
    let contains = false;
    for (const b of serverList) {
      if (a.filepath === b.filepath) {
        contains = true;
        handled.add(b);
        if (a.checksum === b.checksum) {
          a.reference.classList.add("same");
          b.reference.classList.add("same");
        } else {
          if (new Date(a.modified).getTime() > new Date(b.modified).getTime()) {
            toUpload.push(a);
            a.reference.classList.add("newer");
            b.reference.classList.add("older");
          } else {
            toDownload.push(b);
            b.reference.classList.add("newer");
            a.reference.classList.add("older");
          }
        }
      }
    }
    if (!contains) {
      toUpload.push(a);
      a.reference.classList.add("newer");
    }
  }
  for (const b of serverList) {
    if (handled.has(b)) continue;
    toDownload.push(b);
    b.reference.classList.add("newer");
  }
}

function compare(clientList, serverList, handled) {
  for (const a of clientList) {
    let contains = false;
    for (const b of serverList) {
      if (a.filename === b.filename && a.kind === b.kind) {
        contains = true;
        if (a.kind === "directory") {
          compare(a.children, b.children, handled);
          break;
        }
        handled.add(b);
        if (a.checksum === b.checksum) {
          a.reference.classList.add("same");
          b.reference.classList.add("same");
        } else {
          if (new Date(a.modified).getTime() > new Date(b.modified).getTime()) {
            toUpload.push(a);
            a.reference.classList.add("newer");
            b.reference.classList.add("older");
          } else {
            toDownload.push(b);
            b.reference.classList.add("newer");
            a.reference.classList.add("older");
          }
        }
        break;
      }
    }
    if (!contains) {
      if (a.kind === "directory") {
        compare(a.children, [], handled);
      } else {
        toUpload.push(a);
        a.reference.classList.add("newer");
      }
    }
  }
}

function markServerFilesAsNew(handled, serverList) {
  for (const b of serverList) {
    if (handled.has(b)) continue;
    if (b.kind === "directory") {
      //      markServerFilesAsNew(handled, b.children);
      continue;
    }
    toDownload.push(b);
    b.reference.classList.add("newer");
  }
}

window.addEventListener("load", () => {
  if (featureAvailable) {
    fetchProjectData();
  }
  fetchHtpasswd();
});
