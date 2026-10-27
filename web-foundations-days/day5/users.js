/* ============================================================
   Day 5 — users.js
   Fetch users → store → render → filter client-side.
   ============================================================ */
"use strict";

/* ------------------------------------------------------------
   1. Constants + element selection
   ------------------------------------------------------------ */
const API_URL = "https://jsonplaceholder.typicode.com/users";

const loadBtn    = document.querySelector("#load-users");
const filterInput = document.querySelector("#filter-input");
const statusEl   = document.querySelector("#status");
const usersList  = document.querySelector("#users-list");

/* ------------------------------------------------------------
   2. State
   ------------------------------------------------------------ */
/** @type {{id:number, name:string, email:string, city:string, company:string}[]} */
let users = [];
let loaded = false;

/* ------------------------------------------------------------
   3. Status helper
   ------------------------------------------------------------ */
function setStatus(message, type = "info") {
  statusEl.textContent = message;
  statusEl.dataset.type = type;
}

/* ------------------------------------------------------------
   4. loadUsers — async fetch with try/catch/finally
   ------------------------------------------------------------ */
async function loadUsers() {
  loadBtn.disabled = true;
  setStatus("Loading users…", "loading");
  usersList.textContent = "";

  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`Request failed (${response.status} ${response.statusText})`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error("Unexpected response shape.");
    }

    // Normalise to the fields we care about.
    users = data.map((u) => ({
      id: u.id,
      name: u.name ?? "(unnamed)",
      email: u.email ?? "—",
      city: u.address?.city ?? "—",
      company: u.company?.name ?? "—",
    }));
    loaded = true;

    renderUsers(applyFilter(users));
    setStatus(`Loaded ${users.length} user${users.length === 1 ? "" : "s"}.`, "success");
  } catch (err) {
    console.error(err);
    users = [];
    loaded = false;
    usersList.textContent = "";
    setStatus(`Could not load users: ${err.message}`, "error");
  } finally {
    loadBtn.disabled = false;
  }
}

/* ------------------------------------------------------------
   5. Filter (client-side; no new request)
   ------------------------------------------------------------ */
function applyFilter(list) {
  const term = filterInput.value.trim().toLowerCase();
  if (!term) return list;
  return list.filter((u) => u.name.toLowerCase().includes(term));
}

/* ------------------------------------------------------------
   6. renderUsers — build cards with createElement / textContent
   ------------------------------------------------------------ */
function renderUsers(list) {
  usersList.textContent = "";

  if (list.length === 0) {
    const li = document.createElement("li");
    li.className = "empty-message";
    li.textContent = loaded
      ? "No users match your filter."
      : "No users loaded yet.";
    usersList.appendChild(li);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const user of list) {
    const li = document.createElement("li");
    li.className = "user-card";

    const name = document.createElement("p");
    name.className = "user-name";
    name.textContent = user.name;
    li.appendChild(name);

    const email = document.createElement("p");
    email.className = "user-meta";
    email.textContent = `📧 ${user.email}`;
    li.appendChild(email);

    const city = document.createElement("p");
    city.className = "user-meta";
    city.textContent = `📍 ${user.city}`;
    li.appendChild(city);

    const company = document.createElement("p");
    company.className = "user-meta";
    company.textContent = `🏢 ${user.company}`;
    li.appendChild(company);

    fragment.appendChild(li);
  }
  usersList.appendChild(fragment);
}

/* ------------------------------------------------------------
   7. Event wiring
   ------------------------------------------------------------ */
loadBtn.addEventListener("click", loadUsers);

filterInput.addEventListener("input", () => {
  if (!loaded) return; // nothing to filter yet
  renderUsers(applyFilter(users));
});

/* ------------------------------------------------------------
   8. Initial render (empty state)
   ------------------------------------------------------------ */
renderUsers(users);