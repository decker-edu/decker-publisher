window.addEventListener("load", async (event) => {
  const response = await fetch("/api/session");
  if (response.ok) {
    window.Session = await response.json();
  } else {
    window.Session = undefined;
  }
  window.dispatchEvent(new CustomEvent("session"));
});
