const BOOKS_KEY = "pagenestBooksV2";
const OLD_BOOKS_KEY = "pagenestBooksV1";
const STREAK_KEY = "pagenestReadingStreakV2";
const THEME_KEY = "pagenestThemeV1";
const VIEW_KEY = "pagenestViewV1";

const $ = id => document.getElementById(id);

const finishedCount = $("finishedCount");
const readingCount = $("readingCount");
const bookCount = $("bookCount");
const streakCount = $("streakCount");
const streakMessage = $("streakMessage");
const bookGrid = $("bookGrid");
const emptyState = $("emptyState");

const themeBtn = $("themeBtn");
const themeIcon = $("themeIcon");
const themeText = $("themeText");
const deleteModeBtn = $("deleteModeBtn");
const deleteHint = $("deleteHint");
const openAddBtn = $("openAddBtn");
const emptyAddBtn = $("emptyAddBtn");

const librarySearch = $("librarySearch");
const statusFilter = $("statusFilter");
const sortBooks = $("sortBooks");
const gridViewBtn = $("gridViewBtn");
const listViewBtn = $("listViewBtn");

const bookModal = $("bookModal");
const closeModalBtn = $("closeModalBtn");
const modalEyebrow = $("modalEyebrow");
const modalTitle = $("modalTitle");
const bookTitle = $("bookTitle");
const bookAuthor = $("bookAuthor");
const currentPage = $("currentPage");
const totalPages = $("totalPages");
const bookStatus = $("bookStatus");
const bookNote = $("bookNote");
const findCoverBtn = $("findCoverBtn");
const searchStatus = $("searchStatus");
const coverResults = $("coverResults");
const coverUpload = $("coverUpload");
const coverDropzone = $("coverDropzone");
const coverPreview = $("coverPreview");
const removeCoverBtn = $("removeCoverBtn");
const saveBookBtn = $("saveBookBtn");

const deleteModal = $("deleteModal");
const deleteBookTitle = $("deleteBookTitle");
const cancelDeleteBtn = $("cancelDeleteBtn");
const confirmDeleteBtn = $("confirmDeleteBtn");
const toast = $("toast");

let books = loadBooks();
let deleteMode = false;
let editId = null;
let pendingDeleteId = null;
let selectedCover = "";
let selectedAuthor = "";
let currentView = localStorage.getItem(VIEW_KEY) || "grid";

function loadBooks() {
  try {
    const saved = JSON.parse(localStorage.getItem(BOOKS_KEY));
    if (Array.isArray(saved)) return saved;

    const old = JSON.parse(localStorage.getItem(OLD_BOOKS_KEY));
    if (Array.isArray(old)) {
      const migrated = old.map(book => ({
        ...book,
        author: book.author || "",
        status: book.status || "reading"
      }));
      localStorage.setItem(BOOKS_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch {}
  return [];
}

function saveBooks() {
  localStorage.setItem(BOOKS_KEY, JSON.stringify(books));
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function esc(value = "") {
  const div = document.createElement("div");
  div.textContent = String(value);
  return div.innerHTML;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 1900);
}

/* theme */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);

  if (theme === "dark") {
    themeIcon.textContent = "☀";
    themeText.textContent = "Light";
    themeBtn.title = "Switch to light mode";
  } else {
    themeIcon.textContent = "🌙";
    themeText.textContent = "Dark";
    themeBtn.title = "Switch to dark mode";
  }
}
applyTheme(localStorage.getItem(THEME_KEY) || "dark");

themeBtn.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
});

/* streak */
function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shiftDate(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function loadActivityDates() {
  try {
    const data = JSON.parse(localStorage.getItem(STREAK_KEY));
    return Array.isArray(data?.dates) ? data.dates : [];
  } catch {
    return [];
  }
}

function recordReadingActivity() {
  const today = dateKey();
  const dates = loadActivityDates();
  if (!dates.includes(today)) dates.push(today);

  const recent = dates
    .filter(Boolean)
    .sort()
    .slice(-90);

  localStorage.setItem(STREAK_KEY, JSON.stringify({ dates: recent }));
  renderStreak();
}

function computeStreak() {
  const dates = new Set(loadActivityDates());
  const today = new Date();
  const todayKey = dateKey(today);
  const yesterdayKey = dateKey(shiftDate(today, -1));

  let cursor;
  if (dates.has(todayKey)) cursor = today;
  else if (dates.has(yesterdayKey)) cursor = shiftDate(today, -1);
  else return 0;

  let count = 0;
  while (dates.has(dateKey(cursor))) {
    count++;
    cursor = shiftDate(cursor, -1);
  }
  return count;
}

function renderStreak() {
  const dates = new Set(loadActivityDates());
  const today = new Date();
  const streak = computeStreak();

  streakCount.textContent = streak;

  if (dates.has(dateKey(today))) {
    streakMessage.textContent = streak > 1 ? "Keep the streak alive!" : "Great start — come back tomorrow!";
  } else if (streak > 0) {
    streakMessage.textContent = `Read today to keep your ${streak}-day streak!`;
  } else {
    streakMessage.textContent = "Read today to start your streak!";
  }

  document.querySelectorAll(".week-day").forEach(day => day.classList.remove("active"));

  const jsDay = today.getDay(); // Sunday = 0
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = shiftDate(today, mondayOffset);

  for (let i = 0; i < 7; i++) {
    const date = shiftDate(monday, i);
    const key = dateKey(date);
    const dayNumber = date.getDay();
    const cell = document.querySelector(`.week-day[data-day="${dayNumber}"]`);
    if (cell && dates.has(key)) cell.classList.add("active");
  }
}

/* book utilities */
function progress(book) {
  const current = Number(book.currentPage) || 0;
  const total = Number(book.totalPages) || 0;
  if (book.status === "finished") return 100;
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((current / total) * 100)));
}

function visibleBooks() {
  const query = librarySearch.value.trim().toLowerCase();
  const filter = statusFilter.value;

  let list = books.filter(book => {
    const title = String(book.title || "").toLowerCase();
    const author = String(book.author || "").toLowerCase();
    const matchesText = !query || title.includes(query) || author.includes(query);
    const matchesStatus = filter === "all" || (book.status || "reading") === filter;
    return matchesText && matchesStatus;
  });

  switch (sortBooks.value) {
    case "oldest":
      list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      break;
    case "title":
      list.sort((a, b) => String(a.title).localeCompare(String(b.title)));
      break;
    case "progress":
      list.sort((a, b) => progress(b) - progress(a));
      break;
    default:
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }
  return list;
}

function coverMarkup(book) {
  if (book.cover) {
    return `<img class="book-cover" src="${esc(book.cover)}" alt="${esc(book.title)} cover" loading="lazy">`;
  }
  return `<div class="fallback-cover">
    <span>PAGENEST EDITION</span>
    <strong>${esc(book.title)}</strong>
    <small></small>
  </div>`;
}

function bookCard(book) {
  const pct = progress(book);
  const status = book.status || "reading";
  const current = Number(book.currentPage) || 0;
  const total = Number(book.totalPages) || 0;
  const pageText = total ? `${current}/${total}` : `Page ${current}`;
  const author = book.author || "Unknown author";

  return `<article class="book-card ${status === "finished" ? "finished" : ""} ${deleteMode ? "delete-mode" : ""}" data-id="${esc(book.id)}">
    <button class="delete-book-btn" type="button" data-action="delete">🗑 Delete</button>

    <div class="book-card-content" data-action="edit">
      <div class="book-cover-wrap">
        ${coverMarkup(book)}
        <span class="status-pill ${status}">${status === "finished" ? "FINISHED" : "READING"}</span>
      </div>

      <div class="book-details">
        <h3 class="book-title">${esc(book.title)}</h3>
        <p class="book-author">${esc(author)}</p>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="progress-meta">
          <strong>${pct}%</strong>
          <span>${pageText}</span>
        </div>
      </div>
    </div>
  </article>`;
}

function render() {
  const reading = books.filter(book => (book.status || "reading") === "reading").length;
  const finished = books.filter(book => book.status === "finished").length;

  readingCount.textContent = reading;
  finishedCount.textContent = finished;
  bookCount.textContent = books.length;

  const list = visibleBooks();
  bookGrid.innerHTML = list.map(bookCard).join("");

  const noBooks = books.length === 0;
  const noMatches = books.length > 0 && list.length === 0;

  emptyState.classList.toggle("hidden", !noBooks);
  bookGrid.classList.toggle("hidden", noBooks);

  if (noMatches) {
    bookGrid.innerHTML = `<div class="no-results">No books match your search.</div>`;
  }

  deleteHint.classList.toggle("hidden", !deleteMode || noBooks);
  applyView(currentView);
}

/* view */
function applyView(view) {
  currentView = view;
  localStorage.setItem(VIEW_KEY, view);
  const list = view === "list";
  bookGrid.classList.toggle("list-view", list);
  gridViewBtn.classList.toggle("active", !list);
  listViewBtn.classList.toggle("active", list);
}

gridViewBtn.addEventListener("click", () => applyView("grid"));
listViewBtn.addEventListener("click", () => applyView("list"));

/* modal */
function clearCover() {
  selectedCover = "";
  coverPreview.removeAttribute("src");
  coverDropzone.classList.remove("has-cover");
  removeCoverBtn.classList.add("hidden");
}

function setCover(url) {
  selectedCover = url;
  coverPreview.src = url;
  coverDropzone.classList.add("has-cover");
  removeCoverBtn.classList.remove("hidden");
}

function resetForm() {
  editId = null;
  selectedAuthor = "";
  bookTitle.value = "";
  bookAuthor.value = "";
  currentPage.value = "";
  totalPages.value = "";
  bookStatus.value = "reading";
  bookNote.value = "";
  searchStatus.textContent = "";
  coverResults.innerHTML = "";
  coverUpload.value = "";
  clearCover();
}

function openAddModal() {
  resetForm();
  modalEyebrow.textContent = "ADD TO LIBRARY";
  modalTitle.textContent = "Add a new book";
  saveBookBtn.textContent = "＋ Add Book";
  bookModal.classList.remove("hidden");
  setTimeout(() => bookTitle.focus(), 100);
}

function openEditModal(id) {
  const book = books.find(item => item.id === id);
  if (!book) return;

  resetForm();
  editId = id;
  bookTitle.value = book.title || "";
  bookAuthor.value = book.author || "";
  currentPage.value = Number(book.currentPage) || 0;
  totalPages.value = Number(book.totalPages) || "";
  bookStatus.value = book.status || "reading";
  bookNote.value = book.note || "";
  if (book.cover) setCover(book.cover);

  modalEyebrow.textContent = "UPDATE READING";
  modalTitle.textContent = "Edit book";
  saveBookBtn.textContent = "Save Changes";
  bookModal.classList.remove("hidden");
}

function closeBookModal() {
  bookModal.classList.add("hidden");
}

openAddBtn.addEventListener("click", openAddModal);
emptyAddBtn.addEventListener("click", openAddModal);
closeModalBtn.addEventListener("click", closeBookModal);
bookModal.addEventListener("click", event => {
  if (event.target === bookModal) closeBookModal();
});

/* cover search */
async function findCovers() {
  const title = bookTitle.value.trim();
  if (!title) {
    showToast("Write the book title first");
    bookTitle.focus();
    return;
  }

  findCoverBtn.disabled = true;
  findCoverBtn.textContent = "Searching…";
  searchStatus.textContent = "Searching the book catalog…";
  coverResults.innerHTML = "";

  try {
    const response = await fetch(
      `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=12&fields=title,author_name,cover_i`
    );
    if (!response.ok) throw new Error();

    const data = await response.json();
    const matches = (data.docs || []).filter(item => item.cover_i).slice(0, 7);

    if (!matches.length) {
      searchStatus.textContent = "No cover found. You can upload one from your device.";
      return;
    }

    searchStatus.textContent = "Choose the correct cover:";
    coverResults.innerHTML = matches.map(item => {
      const url = `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg`;
      const author = item.author_name?.[0] || "";
      return `<button class="result-cover" type="button"
        data-cover="${esc(url)}"
        data-author="${esc(author)}"
        data-title="${esc(item.title || title)}">
        <img src="${esc(url)}" alt="${esc(item.title || title)} cover">
      </button>`;
    }).join("");
  } catch {
    searchStatus.textContent = "Cover search is unavailable right now. You can upload your own cover.";
  } finally {
    findCoverBtn.disabled = false;
    findCoverBtn.textContent = "⌕ Find cover";
  }
}

findCoverBtn.addEventListener("click", findCovers);
bookTitle.addEventListener("keydown", event => {
  if (event.key === "Enter") findCovers();
});

coverResults.addEventListener("click", event => {
  const result = event.target.closest(".result-cover");
  if (!result) return;

  coverResults.querySelectorAll(".result-cover").forEach(item => item.classList.remove("selected"));
  result.classList.add("selected");
  setCover(result.dataset.cover);

  selectedAuthor = result.dataset.author || "";
  if (!bookAuthor.value.trim() && selectedAuthor) bookAuthor.value = selectedAuthor;

  showToast("Cover selected");
});

coverUpload.addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("Choose an image file");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    setCover(reader.result);
    coverResults.innerHTML = "";
    searchStatus.textContent = "Using your uploaded cover.";
  };
  reader.readAsDataURL(file);
});

removeCoverBtn.addEventListener("click", () => {
  clearCover();
  coverUpload.value = "";
});

/* save */
saveBookBtn.addEventListener("click", () => {
  const title = bookTitle.value.trim();
  const author = bookAuthor.value.trim();
  let page = Number(currentPage.value || 0);
  let total = Number(totalPages.value || 0);
  const status = bookStatus.value;
  const note = bookNote.value.trim();

  if (!title) {
    showToast("Give the book a title");
    bookTitle.focus();
    return;
  }

  if (page < 0 || total < 0) {
    showToast("Page numbers cannot be negative");
    return;
  }

  if (total && page > total) {
    showToast("Last page cannot be greater than total pages");
    return;
  }

  if (status === "finished" && total) page = total;

  if (editId) {
    const book = books.find(item => item.id === editId);
    if (!book) return;

    const oldPage = Number(book.currentPage) || 0;
    book.title = title;
    book.author = author;
    book.cover = selectedCover;
    book.currentPage = page;
    book.totalPages = total;
    book.status = status;
    book.note = note;
    book.updatedAt = Date.now();

    if (page > oldPage) recordReadingActivity();
    showToast("Book updated");
  } else {
    books.unshift({
      id: uid(),
      title,
      author,
      cover: selectedCover,
      currentPage: page,
      totalPages: total,
      status,
      note,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    if (page > 0) recordReadingActivity();
    showToast(`"${title}" added`);
  }

  saveBooks();
  closeBookModal();
  render();
});

/* delete */
deleteModeBtn.addEventListener("click", () => {
  if (!books.length) {
    showToast("Your library is empty");
    return;
  }
  deleteMode = !deleteMode;
  deleteModeBtn.classList.toggle("active", deleteMode);
  render();
  showToast(deleteMode ? "Delete mode active" : "Delete mode off");
});

bookGrid.addEventListener("click", event => {
  const card = event.target.closest(".book-card");
  if (!card) return;

  const deleteButton = event.target.closest('[data-action="delete"]');
  if (deleteButton) {
    pendingDeleteId = card.dataset.id;
    const book = books.find(item => item.id === pendingDeleteId);
    deleteBookTitle.textContent = book ? `"${book.title}" will be removed from your library.` : "";
    deleteModal.classList.remove("hidden");
    return;
  }

  if (!deleteMode && event.target.closest('[data-action="edit"]')) {
    openEditModal(card.dataset.id);
  }
});

cancelDeleteBtn.addEventListener("click", () => {
  pendingDeleteId = null;
  deleteModal.classList.add("hidden");
});

deleteModal.addEventListener("click", event => {
  if (event.target === deleteModal) {
    pendingDeleteId = null;
    deleteModal.classList.add("hidden");
  }
});

confirmDeleteBtn.addEventListener("click", () => {
  const book = books.find(item => item.id === pendingDeleteId);
  books = books.filter(item => item.id !== pendingDeleteId);
  saveBooks();

  pendingDeleteId = null;
  deleteModal.classList.add("hidden");

  if (!books.length) {
    deleteMode = false;
    deleteModeBtn.classList.remove("active");
  }

  render();
  showToast(book ? `"${book.title}" deleted` : "Book deleted");
});

/* filters */
librarySearch.addEventListener("input", render);
statusFilter.addEventListener("change", render);
sortBooks.addEventListener("change", render);

/* keyboard */
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    bookModal.classList.add("hidden");
    deleteModal.classList.add("hidden");
  }
});

renderStreak();
render();
