const DEFAULT_STATE = {
  version: 0,
  updatedAt: null,
  columns: [
    {
      id: "problems",
      title: "Problemas",
      cards: [
        {
          id: createId(),
          title: "Bem-vindos ao quadro",
          description: "Este cartao esta aqui so para mostrar o fluxo. Edite, arraste ou exclua quando as tarefas reais da familia chegarem.",
          tags: ["casa", "exemplo"],
          owner: "",
          tasks: [
            { id: createId(), text: "Clique no lapis para editar um cartao", done: false },
            { id: createId(), text: "Arraste o cartao para outra lista", done: false },
            { id: createId(), text: "Crie a primeira tarefa real da familia", done: false }
          ]
        }
      ]
    },
    { id: "assigned", title: "Atribuidos", cards: [] },
    { id: "doing", title: "Em Andamento", cards: [] },
    { id: "done", title: "Concluido", cards: [] }
  ]
};

const boardElement = document.querySelector("#board");
const searchInput = document.querySelector("#search");
const saveStatus = document.querySelector("#save-status");
const dialog = document.querySelector("#card-dialog");
const cardForm = document.querySelector("#card-form");
const dialogTitle = document.querySelector("#dialog-title");
const closeDialogButton = document.querySelector("#close-dialog");
const cancelDialogButton = document.querySelector("#cancel-dialog");
const deleteCardButton = document.querySelector("#delete-card");
const titleInput = document.querySelector("#card-title");
const descriptionInput = document.querySelector("#card-description");
const tagsInput = document.querySelector("#card-tags");
const ownerInput = document.querySelector("#card-owner");
const tasksInput = document.querySelector("#card-tasks");

let state = cloneState(DEFAULT_STATE);
let activeEditor = null;
let saveTimer = null;
let draggedCardId = null;

init();

async function init() {
  wireEvents();
  await loadBoard();
  renderBoard();
}

function wireEvents() {
  searchInput.addEventListener("input", renderBoard);

  cardForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveEditorChanges();
  });

  deleteCardButton.addEventListener("click", () => {
    if (!activeEditor || !activeEditor.cardId) {
      return;
    }

    deleteCard(activeEditor.columnId, activeEditor.cardId);
    closeDialog();
  });

  closeDialogButton.addEventListener("click", closeDialog);
  cancelDialogButton.addEventListener("click", closeDialog);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog();
  });
}

async function loadBoard(force = false) {
  try {
    const response = await fetch("./api.php", {
      cache: force ? "reload" : "no-store"
    });

    if (!response.ok) {
      throw new Error(`Load failed with status ${response.status}`);
    }

    const payload = await response.json();
    state = normalizeState(payload);
    setStatus(state.updatedAt ? `Carregado ${formatTimestamp(state.updatedAt)}` : "Pronto", "ok");
  } catch (error) {
    console.error(error);
    state = cloneState(DEFAULT_STATE);
    setStatus("Modo local temporario", "warn");
  }
}

function renderBoard() {
  const query = searchInput.value.trim().toLowerCase();
  boardElement.innerHTML = "";

  state.columns.forEach((column) => {
    const visibleCards = column.cards.filter((card) => matchesFilter(card, query));
    const columnElement = document.createElement("section");
    columnElement.className = "column";
    columnElement.dataset.columnId = column.id;

    const countLabel = visibleCards.length === 1 ? "1 cartao" : `${visibleCards.length} cartoes`;

    columnElement.innerHTML = `
      <div class="column-head">
        <div class="column-title-wrap">
          <h2 class="column-title">${escapeHtml(column.title)}</h2>
          <div class="column-meta">${countLabel}</div>
        </div>
      </div>
      <div class="cards" data-column-id="${column.id}"></div>
      <div class="column-actions">
        <button class="ghost add-card" type="button">Novo cartao</button>
      </div>
    `;

    const addCardButton = columnElement.querySelector(".add-card");
    addCardButton.addEventListener("click", () => openDialog(column.id));

    const cardsElement = columnElement.querySelector(".cards");
    cardsElement.addEventListener("dragover", (event) => handleColumnDragOver(event, column.id));
    cardsElement.addEventListener("dragleave", () => cardsElement.classList.remove("drag-target"));
    cardsElement.addEventListener("drop", (event) => handleColumnDrop(event, column.id));

    if (visibleCards.length === 0) {
      const emptyNote = document.createElement("p");
      emptyNote.className = "empty-note";
      emptyNote.textContent = query ? "Nenhum cartao combina com esse filtro." : "Nada por aqui ainda.";
      cardsElement.appendChild(emptyNote);
    } else {
      visibleCards.forEach((card) => {
        cardsElement.appendChild(renderCard(column.id, card));
      });
    }

    boardElement.appendChild(columnElement);
  });
}

function renderCard(columnId, card) {
  const cardElement = document.createElement("article");
  cardElement.className = `card ${card.owner ? `owner-${card.owner}` : ""}`.trim();
  cardElement.draggable = true;
  cardElement.dataset.cardId = card.id;
  const ownerLabel = getOwnerLabel(card.owner);
  const ownerMarkup = ownerLabel ? `<div class="owner-chip owner-${card.owner}">${escapeHtml(ownerLabel)}</div>` : "";

  const tagsMarkup = card.tags.length
    ? `<div class="tag-row">${card.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>`
    : "";

  const tasksMarkup = card.tasks.length
    ? `
      <div class="task-list">
        ${card.tasks
          .map(
            (task) => `
              <label class="task ${task.done ? "done" : ""}">
                <input type="checkbox" data-task-id="${task.id}" ${task.done ? "checked" : ""}>
                <span>${escapeHtml(task.text)}</span>
              </label>
            `
          )
          .join("")}
      </div>
    `
    : "";

  cardElement.innerHTML = `
    <div class="card-head">
      <h3 class="card-title">${escapeHtml(card.title)}</h3>
      <button class="card-edit" type="button" aria-label="Editar cartao">✎</button>
    </div>
    ${ownerMarkup}
    ${card.description ? `<p class="card-description">${escapeHtml(card.description)}</p>` : ""}
    ${tagsMarkup}
    ${tasksMarkup}
  `;

  cardElement.addEventListener("dragstart", () => {
    draggedCardId = card.id;
    cardElement.classList.add("dragging");
  });

  cardElement.addEventListener("dragend", () => {
    draggedCardId = null;
    cardElement.classList.remove("dragging");
    document.querySelectorAll(".cards").forEach((element) => element.classList.remove("drag-target"));
  });

  cardElement.addEventListener("dblclick", () => openDialog(columnId, card.id));

  cardElement.querySelector(".card-edit").addEventListener("click", () => openDialog(columnId, card.id));

  cardElement.querySelectorAll("[data-task-id]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      toggleTask(columnId, card.id, checkbox.dataset.taskId, checkbox.checked);
    });
  });

  return cardElement;
}

function openDialog(columnId, cardId = null) {
  activeEditor = { columnId, cardId };
  const card = cardId ? getCard(columnId, cardId) : null;

  dialogTitle.textContent = card ? "Editar cartao" : "Novo cartao";
  titleInput.value = card?.title ?? "";
  descriptionInput.value = card?.description ?? "";
  tagsInput.value = card?.tags.join(", ") ?? "";
  ownerInput.value = normalizeOwner(card?.owner ?? "");
  tasksInput.value = card?.tasks.map((task) => `${task.done ? "[x]" : "[ ]"} ${task.text}`).join("\n") ?? "";
  deleteCardButton.hidden = !card;
  dialog.showModal();
  titleInput.focus();
}

function closeDialog() {
  dialog.close();
  activeEditor = null;
  cardForm.reset();
}

function saveEditorChanges() {
  if (!activeEditor) {
    return;
  }

  const payload = {
    title: titleInput.value.trim(),
    description: descriptionInput.value.trim(),
    tags: parseTags(tagsInput.value),
    owner: normalizeOwner(ownerInput.value),
    tasks: parseTasks(tasksInput.value)
  };

  if (!payload.title) {
    titleInput.focus();
    return;
  }

  if (activeEditor.cardId) {
    updateCard(activeEditor.columnId, activeEditor.cardId, payload);
  } else {
    createCard(activeEditor.columnId, payload);
  }

  closeDialog();
}

function createCard(columnId, payload) {
  const column = state.columns.find((item) => item.id === columnId);

  if (!column) {
    return;
  }

  column.cards.unshift({
    id: createId(),
    title: payload.title,
    description: payload.description,
    tags: payload.tags,
    owner: payload.owner,
    tasks: payload.tasks
  });

  renderBoard();
  queueSave();
}

function updateCard(columnId, cardId, payload) {
  const card = getCard(columnId, cardId);

  if (!card) {
    return;
  }

  card.title = payload.title;
  card.description = payload.description;
  card.tags = payload.tags;
  card.owner = payload.owner;
  card.tasks = payload.tasks;
  renderBoard();
  queueSave();
}

function deleteCard(columnId, cardId) {
  const column = state.columns.find((item) => item.id === columnId);

  if (!column) {
    return;
  }

  column.cards = column.cards.filter((card) => card.id !== cardId);
  renderBoard();
  queueSave();
}

function toggleTask(columnId, cardId, taskId, done) {
  const card = getCard(columnId, cardId);
  const task = card?.tasks.find((item) => item.id === taskId);

  if (!task) {
    return;
  }

  task.done = done;
  renderBoard();
  queueSave();
}

function handleColumnDragOver(event, targetColumnId) {
  event.preventDefault();
  const cardsElement = event.currentTarget;
  cardsElement.classList.add("drag-target");
}

function handleColumnDrop(event, targetColumnId) {
  event.preventDefault();
  event.currentTarget.classList.remove("drag-target");
  const draggingCard = findCardById(draggedCardId);

  if (!draggingCard) {
    return;
  }

  const afterCard = getDragAfterElement(event.currentTarget, event.clientY);
  const column = state.columns.find((item) => item.id === targetColumnId);
  const targetIndex = afterCard
    ? column.cards.findIndex((card) => card.id === afterCard.dataset.cardId)
    : column.cards.length;

  moveCard(draggingCard.columnId, targetColumnId, draggedCardId, targetIndex, true);
}

function moveCard(fromColumnId, toColumnId, cardId, targetIndex, persist) {
  const fromColumn = state.columns.find((item) => item.id === fromColumnId);
  const toColumn = state.columns.find((item) => item.id === toColumnId);

  if (!fromColumn || !toColumn) {
    return;
  }

  const currentIndex = fromColumn.cards.findIndex((card) => card.id === cardId);

  if (currentIndex === -1) {
    return;
  }

  const [card] = fromColumn.cards.splice(currentIndex, 1);
  const normalizedIndex =
    fromColumnId === toColumnId && currentIndex < targetIndex ? targetIndex - 1 : targetIndex;

  toColumn.cards.splice(Math.max(0, normalizedIndex), 0, card);
  renderBoard();

  if (persist) {
    queueSave();
  }
}

function getCard(columnId, cardId) {
  return state.columns
    .find((column) => column.id === columnId)
    ?.cards.find((card) => card.id === cardId);
}

function findCardById(cardId) {
  for (const column of state.columns) {
    const card = column.cards.find((item) => item.id === cardId);
    if (card) {
      return { columnId: column.id, card };
    }
  }

  return null;
}

function getDragAfterElement(container, y) {
  const cards = [...container.querySelectorAll(".card:not(.dragging)")];

  return cards.reduce(
    (closest, card) => {
      const box = card.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;

      if (offset < 0 && offset > closest.offset) {
        return { offset, element: card };
      }

      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
}

function queueSave() {
  setStatus("Salvando...", "warn");
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveBoard, 450);
}

async function saveBoard() {
  try {
    const response = await fetch("./api.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(state)
    });

    const payload = await response.json();

    if (response.status === 409) {
      state = normalizeState(payload.current ?? DEFAULT_STATE);
      renderBoard();
      setStatus("Conflito: quadro recarregado", "warn");
      return;
    }

    if (!response.ok) {
      throw new Error(payload.error || `Falha ao salvar com status ${response.status}`);
    }

    state = normalizeState(payload);
    setStatus(`Salvo ${formatTimestamp(state.updatedAt)}`, "ok");
  } catch (error) {
    console.error(error);
    setStatus("Falha ao salvar", "error");
  }
}

function matchesFilter(card, query) {
  if (!query) {
    return true;
  }

  const haystack = [
    card.title,
    card.description,
    getOwnerLabel(card.owner),
    card.tags.join(" "),
    card.tasks.map((task) => task.text).join(" ")
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function parseTags(rawValue) {
  return rawValue
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function parseTasks(rawValue) {
  return rawValue
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 24)
    .map((line) => {
      let done = false;
      let text = line;

      if (line.startsWith("[x] ")) {
        done = true;
        text = line.slice(4);
      } else if (line.startsWith("[ ] ")) {
        text = line.slice(4);
      }

      return {
        id: createId(),
        text,
        done
      };
    });
}

function normalizeState(payload) {
  const source = payload && typeof payload === "object" ? payload : DEFAULT_STATE;
  const columns = Array.isArray(source.columns) ? source.columns : DEFAULT_STATE.columns;
  const normalizedColumns = [];

  for (let index = 0; index < 4; index += 1) {
    const defaultColumn = DEFAULT_STATE.columns[index];
    const column = columns[index] ?? defaultColumn;

    normalizedColumns.push({
      id: defaultColumn.id,
      title: defaultColumn.title,
      cards: Array.isArray(column.cards)
        ? column.cards.map((card) => ({
            id: typeof card.id === "string" && card.id ? card.id : createId(),
            title: typeof card.title === "string" && card.title.trim() ? card.title.trim() : "Cartao sem titulo",
            description: typeof card.description === "string" ? card.description.trim() : "",
            tags: Array.isArray(card.tags)
              ? card.tags
                  .map((tag) => String(tag).trim())
                  .filter(Boolean)
                  .slice(0, 8)
              : [],
            owner: normalizeOwner(card.owner),
            tasks: Array.isArray(card.tasks)
              ? card.tasks
                  .map((task) => ({
                    id: typeof task.id === "string" && task.id ? task.id : createId(),
                    text: typeof task.text === "string" ? task.text.trim() : "",
                    done: Boolean(task.done)
                  }))
                  .filter((task) => task.text)
                  .slice(0, 24)
              : []
          }))
        : []
    });
  }

  return {
    version: Number.isInteger(source.version) ? source.version : 0,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : null,
    columns: normalizedColumns
  };
}

function setStatus(message, tone = "") {
  saveStatus.textContent = message;
  saveStatus.className = "status-pill";

  if (tone) {
    saveStatus.classList.add(tone);
  }
}

function formatTimestamp(isoString) {
  if (!isoString) {
    return "agora";
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

function normalizeOwner(value) {
  return value === "me" || value === "wife" ? value : "";
}

function getOwnerLabel(owner) {
  if (owner === "me") {
    return "Vitor";
  }

  if (owner === "wife") {
    return "Fran";
  }

  return "";
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneState(value) {
  return JSON.parse(JSON.stringify(value));
}
