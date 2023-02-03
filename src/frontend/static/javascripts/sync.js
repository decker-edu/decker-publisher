let featureAvailable = true;
if (
  !window.showDirectoryPicker ||
  typeof window.showDirectoryPicker !== "function"
) {
  featureAvailable = false;
  const main = document.getElementById("content");
  while (main.firstChild) {
    main.removeChild(main.lastChild);
  }
  const div = document.createElement("div");
  const h1 = document.createElement("h1");
  div.appendChild(h1);
  main.appendChild(div);
  const i = document.createElement("i");
  i.classList.add("fa-brands");
  i.classList.add("fa-chrome");
  i.style.fontSize = "8rem";
  h1.textContent = "Diese Funktion wird von diesem Browser nicht unterstützt.";
  const text = document.createElement("p");
  main.appendChild(i);
  main.appendChild(text);
  text.innerText = "Bitte benutzen Sie einen auf Chrome basierenden Browser.";
}

function toggleCaret(event) {
  if (event.target === event.currentTarget) {
    event.target.classList.toggle("active");
  }
}

function requestFiles() {
  if (!featureAvailable) return;
  chooseDirectory().then(() => {});
}

async function appendData(dataset, list) {
  for (const item of dataset) {
    if (item.kind === "file") {
      const listitem = document.createElement("li");
      listitem.classList.add("file-item");
      listitem.innerText = item.filename;
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

let fsHandle;

async function chooseDirectory() {
  window.showDirectoryPicker({ mode: "readwrite" }).then(async (handle) => {
    fsHandle = handle;
    const checksums = await accumulateFileInformation(handle.entries());
    clientData = checksums;
    const clientList = document.getElementById("client-table");
    await appendData(checksums, clientList);
    compareData();
  });
}

async function pushFile(filename, file) {
  const buffer = await file.arrayBuffer();
  const response = await fetch("/api/project/workshop/sync/" + filename, {
    method: "POST",
    body: {
      data: buffer,
    },
  });
  if (response && response.ok) {
    return;
  } else {
    const status = response.status;
    console.error("pushing file " + filename + " ended in status: " + status);
  }
}

async function accumulateFileInformation(entries) {
  const data = [];
  for await (const [key, value] of entries) {
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
        modified: lastModified,
        checksum: hex,
        children: null,
      });
    } else if (value.kind === "directory") {
      const recursion = await accumulateFileInformation(value.entries());
      data.push({
        kind: "directory",
        filename: key,
        modified: null,
        checksum: null,
        children: recursion,
      });
    }
  }
  return data;
}

window.addEventListener("load", () => {
  const serverTable = document.getElementById("server-table");
  const data = document.getElementById("project-file-data");
  const json = JSON.parse(data.innerHTML);
  serverData = json;
  appendData(json, serverTable);
});

let serverData;
let clientData;

function compareData() {
  compare(clientData, serverData);
}

function compare(rootA, rootB) {
  for (const a of rootA) {
    let contains = false;
    for (const b of rootB) {
      if (a.kind === b.kind) {
        if (a.filename === b.filename) {
          contains = true;
          if (a.kind === "directory") {
            compare(a.children, b.children);
            break;
          }
          if (a.checksum === b.checksum) {
            a.reference.classList.add("same");
            b.reference.classList.add("same");
          } else {
            console.log(a.lastModified, b.lastModified);
            if (a.lastModified > b.lastModified) {
              a.reference.classList.add("newer");
              b.reference.classList.add("older");
            } else {
              b.reference.classList.add("newer");
              a.reference.classList.add("older");
            }
          }
          break;
        }
      }
    }
    if (!contains) {
      a.reference.classList.add("newer");
    }
  }
}
