function getCSRFToken() {
  const element = document.querySelector("meta[name='csrf']");
  if (!element) {
    return "error-token";
  }
  const token = element.getAttribute("value");
  if (!token) {
    return "error-token";
  }
  return token;
}

window.getCSRFToken = getCSRFToken;
