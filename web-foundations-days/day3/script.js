/*
   QuickNotes — Notes Toolkit Day 3 Assignment
*/

let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

function searchNotes(word) {
  const needle = word.toLowerCase();
  return notes.filter((note) =>
    note.text.toLowerCase().includes(needle)
  );
}

function longestNote() {
  if (notes.length === 0) return null;

  let longest = notes[0];

  for (const note of notes) {
    if (note.text.length > longest.text.length) {
      longest = note;
    }
  }

  return longest;
}

function countByCategory() {
  const counts = {};

  for (const note of notes) {
    counts[note.category] = (counts[note.category] || 0) + 1;
  }

  return counts;
}

function getSummary() {
  const counts = countByCategory();
  const total = notes.length;
  const noun = total === 1 ? "note" : "notes";

  const parts = Object.entries(counts)
    .map(([category, count]) => `${count} ${category}`)
    .join(", ");

  return `${total} ${noun}: ${parts}.`;
}

function isDuplicate(text) {
  const normalise = (value) =>
    value.trim().toLowerCase().replace(/\s+/g, " ");

  const target = normalise(text);

  return notes.some((note) => normalise(note.text) === target);
}

function addNote(text, category) {
  const allowedCategories = ["personal", "work", "study"];

  if (typeof text !== "string" || text.trim().length < 1 || text.length > 200) {
    console.log("addNote failed: text must be 1–200 characters.");
    return false;
  }

  if (!allowedCategories.includes(category)) {
    console.log(`addNote failed: "${category}" is not a valid category.`);
    return false;
  }

  if (isDuplicate(text)) {
    console.log("addNote failed: duplicate note.");
    return false;
  }

  const nextId =
    notes.length === 0 ? 1 : Math.max(...notes.map((note) => note.id)) + 1;

  const trimmedText = text.trim();
  notes.push({ id: nextId, text: trimmedText, category });

  console.log(`addNote added: "${trimmedText}" [${category}]`);
  return true;
}

// Testing the functions


console.log("--- searchNotes ---");

// Expected: [{ id: 1, text: "Buy milk and bread", category: "personal" }]
console.log(searchNotes("MILK"));

// Expected: []
console.log(searchNotes("zebra"));

console.log("--- longestNote ---");

// Expected: { id: 3, text: "Email the project report to Grace", category: "work" }
console.log(longestNote());

const savedNotes = notes;
notes = [];

// Expected: null
console.log(longestNote());

notes = savedNotes;

console.log("--- countByCategory ---");

// Expected: { personal: 2, study: 2, work: 1 }
console.log(countByCategory());

notes = [];

// Expected: {}
console.log(countByCategory());

notes = savedNotes;

console.log("--- getSummary ---");

// Expected: "5 notes: 2 personal, 2 study, 1 work."
console.log(getSummary());

notes = [{ id: 99, text: "Solo note", category: "study" }];

// Expected: "1 note: 1 study."
console.log(getSummary());

notes = savedNotes;

console.log("--- isDuplicate ---");

// Expected: true
console.log(isDuplicate("buy milk and bread"));

// Expected: true
console.log(isDuplicate("  Buy   milk   and   bread  "));

// Expected: false
console.log(isDuplicate("Buy eggs"));

console.log("--- addNote ---");

// Expected: true
console.log(addNote("Buy eggs", "personal"));

// Expected: false — duplicate note
console.log(addNote("buy milk and bread", "personal"));

// Expected: false — invalid category
console.log(addNote("Plan the trip", "travel"));

// Expected: false — text exceeds 200 characters
console.log(addNote("x".repeat(201), "work"));

console.log("--- final state ---");

// Expected: 6 notes, including "Buy eggs"
console.log(notes);

// Expected: "6 notes: 3 personal, 2 study, 1 work."
console.log(getSummary());

