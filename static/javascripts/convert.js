let g_filename = undefined;
function inputChanged() {
  const input = document.getElementById("file-upload-input");
  if (input.value) {
    let filename = input.value.split(/(\/|\\)/g).pop();
    if (filename) {
      const label = document.getElementById("file-upload-label");
      label.innerText = filename;
      const button = document.getElementById("file-upload-button");
      button.removeAttribute("hidden");
      g_filename = filename;
    }
  }
}

function passOn(event) {
  const input = document.getElementById("file-upload-input");
  input.click();
}

let timer = undefined;

function cleanLocalLog() {
  const div = document.getElementById("local-log");
  while (div.firstChild) {
    div.removeChild(div.lastChild);
  }
}

function cleanServerLog() {
  const div = document.getElementById("server-log");
  while (div.firstChild) {
    div.removeChild(div.lastChild);
  }
}

function addToLocalLog(text) {
  const div = document.getElementById("local-log");
  const insert = document.createElement("span");
  insert.innerText = text;
  div.appendChild(insert);
}

function addToServerLog(text) {
  const div = document.getElementById("server-log");
  const insert = document.createElement("span");
  insert.innerText = text;
  div.appendChild(insert);
}

async function upload() {
  cleanLocalLog();
  cleanServerLog();
  const input = document.querySelector("#file-upload-input");
  const data = new FormData();
  data.append("file", input.files[0]);
  const request = new Request("/api/convert", {
    method: "POST",
    body: data,
  });
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const json = await response.json();
      addToLocalLog("Datei erfolgreich hochgeladen.");
      if (json.message) {
        addToLocalLog(json.message);
      }
      setTimeout(() => connect(), 1000);
    } else {
      const json = await response.json();
      addToLocalLog("Ein Fehler ist aufgetreten.");
      if (json.message) {
        addToLocalLog(json.message);
      }
    }
  } catch (error) {
    console.log(error);
    addToLocalLog("Ein Fehler ist beim übertragen der Daten aufgetreten.");
    addText(error);
  }
}

function connect() {
  if (!g_filename) return;
  let zipname = g_filename.substring(0, g_filename.lastIndexOf(".")) + ".zip";
  const source = new EventSource(
    `/api/convert/events?file=${encodeURIComponent(zipname)}`
  );
  source.addEventListener("open", (event) => {
    addToLocalLog("Verbindung zum Server hergestellt ...");
  });
  source.addEventListener("info", (event) => {
    addToServerLog(event.data);
  });
  source.addEventListener("done", (event) => {
    addToServerLog(event.data);
    download();
    source.close();
    addToLocalLog("Verbindung zum Server getrennt.");
  });
  source.addEventListener("error", (event) => {
    console.log(event);
    addToServerLog(event.data);
    source.close();
    addToLocalLog("Verbindung zum Server getrennt.");
  });
  let cog = document.getElementById("waitingcog");
  if (cog) {
    cog.className = "fas fa-cog turning";
  } else {
    const div = document.getElementById("explanation");
    cog = document.createElement("i");
    cog.id = "waitingcog";
    cog.className = "fas fa-cog turning";
    div.appendChild(cog);
  }
}

async function download(retry) {
  if (!g_filename) return;
  let zipname = g_filename.substring(0, g_filename.lastIndexOf(".")) + ".zip";
  const response = await fetch(
    "/api/convert?file=" + encodeURIComponent(zipname),
    {
      method: "GET",
    }
  );
  if (response && response.ok) {
    addToLocalLog("Download verfügbar.");
    const blob = await response.blob();
    var url = window.URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = zipname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    const cog = document.getElementById("waitingcog");
    if (cog) {
      cog.className = "fas fa-check";
    }
  } else {
    addToLocalLog("Download fehlgeschlagen.");
    if (!retry) {
      addToLocalLog("Versuche in 3 Sekunden einen erneuten Download ...");
      setTimeout(() => download(true), 3000);
    } else {
      const cog = document.getElementById("waitingcog");
      if (cog) {
        cog.className = "fas fa-times";
      }
    }
  }
}
