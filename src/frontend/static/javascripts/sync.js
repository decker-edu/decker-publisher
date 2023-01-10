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

const carets = document.getElementsByClassName("caret");
for (const caret of carets) {
  caret.addEventListener("click", (event) => {
    const target = event.target;
    if (target === caret) {
      caret.classList.toggle("active");
    }
  });
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
      listitem.innerText = item.name;
      list.appendChild(listitem);
    } else if (item.kind === "directory") {
      const listitem = document.createElement("li");
      const innerlist = document.createElement("ul");
      listitem.addEventListener("click", toggleCaret);
      listitem.classList.add("directory-item");
      listitem.classList.add("caret");
      listitem.innerText = item.name;
      listitem.appendChild(innerlist);
      list.appendChild(listitem);
      appendData(item.data, innerlist);
    }
  }
}

async function chooseDirectory() {
  window.showDirectoryPicker({ mode: "readwrite" }).then(async (handle) => {
    const checksums = await accumulateFileInformation(handle.entries());
    const clientList = document.getElementById("client-table");
    appendData(checksums, clientList);
  });
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
        name: key,
        modified: lastModified,
        data: hex,
      });
    } else if (value.kind === "directory") {
      const recursion = await accumulateFileInformation(value.entries());
      data.push({
        kind: "directory",
        name: key,
        modified: null,
        data: recursion,
      });
    }
  }
  return data;
}
