/* ============================================================
   QuickNotes — Day 4
   Character counter + word counter + theme toggle + draft
   ============================================================ */

/* ---------- 1. Element references ---------- */
const textarea   = document.getElementById("note-text");
const charCount  = document.getElementById("char-count");
const wordCount  = document.getElementById("word-count");
const clearBtn   = document.getElementById("clear-btn");
const themeBtn   = document.getElementById("theme-toggle");

/* ---------- 2. Constants ---------- */
const MAX_CHARS      = 200;
const WARNING_LIMIT  = 180;
const DRAFT_KEY      = "quicknotes-draft";
const THEME_KEY      = "quicknotes-theme";

/* ---------- 3. updateCounts() ---------- */
/**
 * Updates the character counter, the word counter, and applies
 * the `warning` / `over` classes to the character counter.
 */
function updateCounts() {
  const text  = textarea.value;
  const chars = text.length;

  // Character counter text
  charCount.textContent = `${chars} / ${MAX_CHARS} characters`;

  // Word counter text (count non-empty sequences separated by whitespace)
  const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  wordCount.textContent = `${words} ${words === 1 ? "word" : "words"}`;

  // Warning / over classes
  charCount.classList.remove("warning", "over");
  if (chars > MAX_CHARS) {
    charCount.classList.add("over");
  } else if (chars > WARNING_LIMIT) {
    charCount.classList.add("warning");
  }
}

/* ---------- 4. Draft helpers ---------- */
/**
 * Saves the current textarea contents as a draft.
 * If the textarea is empty, the draft is removed rather than
 * stored as an empty string, so "no draft" and "empty draft"
 * are the same state.
 */
function saveDraft() {
  const text = textarea.value;
  if (text === "") {
    localStorage.removeItem(DRAFT_KEY);
  } else {
    localStorage.setItem(DRAFT_KEY, text);
  }
}

/**
 * Restores a saved draft, if one exists.
 * Ignores anything that isn't a non-empty string, so a corrupt
 * or manually-edited localStorage entry can't break the page.
 */
function restoreDraft() {
  const saved = localStorage.getItem(DRAFT_KEY);
  if (typeof saved === "string" && saved.length > 0) {
    textarea.value = saved;
  }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

/* ---------- 5. Theme helpers ---------- */
function applyTheme(theme) {
  if (theme === "dark") {
    document.body.classList.add("dark");
    themeBtn.textContent = "Light mode";
  } else {
    document.body.classList.remove("dark");
    themeBtn.textContent = "Dark mode";
  }
}

function restoreTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "light";
  applyTheme(saved);
}

function toggleTheme() {
  const isDark = document.body.classList.contains("dark");
  const next   = isDark ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
}

/* ---------- 6. Clear helper ---------- */
function clearAll() {
  textarea.value = "";
  clearDraft();
  updateCounts();
  textarea.focus();
}

/* ---------- 7. Wire up events ---------- */

// On every keystroke: update counters + persist draft
textarea.addEventListener("input", () => {
  updateCounts();
  saveDraft();
});

// Escape inside the textarea clears everything
textarea.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    clearAll();
  }
});

// Clear button
clearBtn.addEventListener("click", clearAll);

// Theme toggle button
themeBtn.addEventListener("click", toggleTheme);

/* ---------- 8. Initialise on load ---------- */
restoreDraft();
restoreTheme();
updateCounts();