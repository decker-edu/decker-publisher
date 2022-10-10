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

function requestFiles() {
  if (!featureAvailable) return;
  chooseDirectory().then(() => {});
}

async function chooseDirectory() {
  window.showDirectoryPicker({ mode: "readwrite" }).then(async (handle) => {
    for await (const [key, value] of handle.entries()) {
      if (value.kind === "file") {
        value.getFile().then(async (file) => {
          const buffer = await file.arrayBuffer();
          const hash = await crypto.subtle.digest("SHA-256", buffer);
          const array = Array.from(new Uint8Array(hash));
          const hex = array
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          console.log({ key, hex });
        });
      }
    }
  });
}

async function getHashes(dirHandle) {}
