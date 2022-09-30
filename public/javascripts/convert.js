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

function upload() {
  const input = document.querySelector("#file-upload-input");
  const data = new FormData();
  data.append("file", input.files[0]);
  const request = new Request("/api/convert", {
    method: "POST",
    body: data,
  });
  fetch(request)
    .then((response) => {
      if (response.ok) {
        console.log("ok");
        return response.json();
      } else {
        console.log("not ok");
        return response.json();
      }
    })
    .then((json) => {
      const div = document.getElementById("insert-area");
      while (div.firstChild) {
        div.removeChild(div.lastChild);
      }
      div.appendChild(document.createTextNode(json.message));
      timer = setInterval(check, 1000);
    })
    .catch((error) => {
      const div = document.getElementById("insert-area");
      while (div.firstChild) {
        div.removeChild(div.lastChild);
      }
      div.appendChild(document.createTextNode("Interner Fehler"));
    });
}

function check() {
  if (!g_filename) return;
  let zipname = g_filename.substring(0, g_filename.lastIndexOf(".")) + ".zip";
  fetch("/api/convert?file=" + zipname, {
    method: "GET",
  }).then((response) => {
    if (response.ok) {
      const div = document.getElementById("insert-area");
      while (div.firstChild) {
        div.removeChild(div.lastChild);
      }
      div.appendChild(document.createTextNode("Konvertierung fertig."));
      clearInterval(timer);
      response.blob().then((blob) => {
        var url = window.URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = zipname;
        document.body.appendChild(a);
        a.click();
        a.remove();
      });
    } else {
      const div = document.getElementById("insert-area");
      while (div.firstChild) {
        div.removeChild(div.lastChild);
      }
      div.appendChild(document.createTextNode("Konvertierung im Gange."));
      let cog = document.createElement("i");
      cog.classList.add("fas");
      cog.classList.add("fa-cog");
      cog.classList.add("turning");
      div.appendChild(cog);
    }
  });
}
