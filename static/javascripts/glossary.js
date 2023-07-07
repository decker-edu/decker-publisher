function addGlossaryName() {
  const namesDiv = document.getElementById("names-container");
  const nameInput = document.createElement("input");
  const nameDiv = document.createElement("div");
  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.classList.add("action");
  const icon = document.createElement("i");
  icon.classList.add("fas");
  icon.classList.add("fa-trash");
  deleteButton.title = "Eintrag löschen";
  deleteButton.setAttribute("aria-label", "Eintrag löschen");
  deleteButton.appendChild(icon);
  deleteButton.addEventListener("click", () => {
    namesDiv.removeChild(nameDiv);
  });
  nameDiv.classList.add("name-entry");
  nameInput.classList.add("name-input");
  nameDiv.appendChild(nameInput);
  nameDiv.appendChild(deleteButton);
  namesDiv.appendChild(nameDiv);
  return nameInput;
}

function addGlossaryItem() {
  const itemsDiv = document.getElementById("items-container");
  const itemNameInput = document.createElement("input");
  itemNameInput.classList.add("item-name-input");
  const itemDescInput = document.createElement("input");
  itemDescInput.classList.add("item-desc-input");
  const itemDiv = document.createElement("div");
  itemDiv.classList.add("item-container");
  const inputDiv = document.createElement("div");
  inputDiv.classList.add("input-container");
  const nameLabel = document.createElement("span");
  nameLabel.innerText = "Begriff";
  const descLabel = document.createElement("span");
  descLabel.innerText = "Beschreibung";
  const deleteButton = document.createElement("button");
  deleteButton.classList.add("action");
  deleteButton.type = "button";
  const icon = document.createElement("i");
  icon.classList.add("fas");
  icon.classList.add("fa-trash");
  deleteButton.title = "Eintrag löschen";
  deleteButton.setAttribute("aria-label", "Eintrag löschen");
  deleteButton.appendChild(icon);
  deleteButton.addEventListener("click", () => {
    itemsDiv.removeChild(itemDiv);
  });
  inputDiv.appendChild(nameLabel);
  inputDiv.appendChild(descLabel);
  inputDiv.appendChild(itemNameInput);
  inputDiv.appendChild(itemDescInput);
  itemDiv.appendChild(inputDiv);
  itemDiv.appendChild(deleteButton);
  itemsDiv.appendChild(itemDiv);
  return { name: itemNameInput, description: itemDescInput };
}

async function confirmGlossary() {
  const name = document.getElementById("glossary-name-input").value;
  if (name === "") {
    const msg = document.getElementById("status-message");
    msg.innerText = "Das Glossar muss einen Namen besitzen.";
    return;
  }
  const namesDiv = document.getElementById("names-container");
  const itemsDiv = document.getElementById("items-container");
  const nameInputs = namesDiv.getElementsByClassName("name-input");
  const names = [];
  for (const input of nameInputs) {
    const nameValue = input.value;
    if (!nameValue || nameValue === "") continue;
    names.push(nameValue);
  }
  const itemDivs = itemsDiv.getElementsByClassName("input-container");
  const items = [];
  for (const inputs of itemDivs) {
    const nameInput = inputs.getElementsByClassName("item-name-input")[0];
    const descInput = inputs.getElementsByClassName("item-desc-input")[0];
    if (!nameInput.value || nameInput.value === "") continue;
    items.push({ name: nameInput.value, description: descInput.value });
  }
  if (names.length == 0 && items.length == 0) {
    return;
  }
  const id = window.location.href.substring(
    window.location.href.lastIndexOf("/") + 1
  );
  if (id && id !== "new") {
    updateGlossary(id, name, names, items);
  } else {
    createGlossary(name, names, items);
  }
}

async function updateGlossary(id, name, names, items) {
  const bdy = {
    name: name,
    names: names,
    items: items,
  };
  console.log(bdy);
  try {
    const response = await fetch("/api/amberscript/glossary/" + id, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bdy),
    });
    if (response.ok) {
      window.location.replace("/glossaries");
    } else {
      const json = await response.json();
      showMessage(json.message);
    }
  } catch (error) {
    showMessage(error);
  }
}

async function createGlossary(name, names, items) {
  const bdy = {
    name: name,
    names: names,
    items: items,
  };
  console.log(bdy);
  try {
    const response = await fetch("/api/amberscript/glossary", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bdy),
    });
    if (response.ok) {
      window.location.replace("/glossaries");
    } else {
      const json = await response.json();
      showMessage(json.message);
    }
  } catch (error) {
    showMessage(error);
  }
}

function showMessage(message) {
  const span = document.getElementById("status-message");
  span.innerText = message;
}

async function loadGlossary() {
  const id = window.location.href.substring(
    window.location.href.lastIndexOf("/") + 1
  );
  if (id && id !== "new") {
    const response = await fetch("/api/amberscript/glossary/" + id);
    if (response.ok) {
      const json = await response.json();
      const name = json.name.split(":")[1];
      const names = json.names;
      const items = json.items;
      document.getElementById("glossary-name-input").value = name;
      for (const name of names) {
        const input = addGlossaryName();
        input.value = name;
      }
      for (const item of items) {
        const inputs = addGlossaryItem();
        inputs.name.value = item.name;
        inputs.description.value = item.description;
      }
    }
  }
}

window.addEventListener("load", () => {
  loadGlossary();
});
