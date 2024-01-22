export default class UploadProgress {
  xhr;
  label;
  url;
  bar;
  data;

  constructor(file, url, bar, label) {
    this.url = url;
    this.bar = bar;
    this.label = label;

    function updateProgressBar(event) {
      const total = event.total;
      const loaded = event.loaded;
      if (event.lengthComputable) {
        const part = (loaded / total) * 100;
        bar.value = part;
        label.innerText = `${part}%`;
      } else {
        if (loaded) {
          bar.value = loaded;
          label.innerText = loaded;
        }
      }
    }

    function initializeProgressBar(event) {
      bar.value = 0;
      bar.max = 100;
      if (bar.hasAttribute("hidden")) {
        bar.removeAttribute("hidden");
      }
      updateProgressBar(event);
    }

    this.data = new FormData();
    this.data.append("file", file);
    this.xhr = new XMLHttpRequest();
    this.xhr.upload.addEventListener("progress", updateProgressBar);
    this.xhr.addEventListener("loadstart", initializeProgressBar);
  }

  start() {
    this.xhr.open("POST", this.url);
    this.xhr.send(this.data);
  }

  addEventListener(event, callback) {
    this.xhr.addEventListener(event, callback);
  }
}
