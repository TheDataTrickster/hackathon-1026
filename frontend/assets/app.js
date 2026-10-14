const screens = {
  input: document.getElementById("screen-input"),
  loading: document.getElementById("screen-loading"),
  result: document.getElementById("screen-result"),
};

const form = document.getElementById("extract-form");
const titleInput = document.getElementById("title");
const descriptionInput = document.getElementById("description");
const titleCount = document.getElementById("title-count");
const descriptionCount = document.getElementById("description-count");
const attrsTable = document.getElementById("attrs-table");
const resultTitle = document.getElementById("result-title");
const resultDescription = document.getElementById("result-description");
const categoryLabel = document.getElementById("category-label");
const loadingHint = document.getElementById("loading-hint");
const toast = document.getElementById("toast");

const TITLE_LIMIT = 300;
const DESCRIPTION_LIMIT = 6000;

function updateCharCount(input, counter, limit) {
  const length = input.value.length;
  counter.textContent = `${length} / ${limit}`;
  counter.classList.toggle("is-limit", length >= limit);
}

const EXAMPLES = {
  phone: {
    title: "Смартфон Samsung Galaxy S24 256 ГБ чёрный",
    description:
      "Флагманский смартфон Samsung Galaxy S24 с диагональю экрана 6,2 дюйма, объёмом памяти 256 ГБ и батареей 4000 мАч. Корпус чёрный, поддержка 5G.",
  },
  laptop: {
    title: "Ноутбук ASUS VivoBook 16 Intel Core i5 16 ГБ ОЗУ SSD 512 ГБ серебристый",
    description:
      "Ноутбук ASUS VivoBook 16 на процессоре Intel Core i5-1235U, 16 ГБ оперативной памяти и накопителем SSD 512 ГБ. Диагональ экрана 16 дюймов, цвет серебристый.",
  },
  weak: {
    title: "Телефон хороший новый",
    description: "Красивый аппарат алого цвета, памяти много, экран большой. Батарея держит весь день.",
  },
};

const LOADING_STEPS = [
  "Читаю название и описание",
  "Определяю категорию и обязательные поля",
  "Извлекаю и нормализую значения",
  "Оцениваю уверенность",
];

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    const active = key === name;
    el.hidden = !active;
    el.classList.toggle("is-active", active);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function playLoading() {
  showScreen("loading");
  for (const step of LOADING_STEPS) {
    loadingHint.textContent = step;
    await sleep(450);
  }
}

function formatConfidence(value) {
  return value.toFixed(2).replace(".", ",");
}

function renderAttributes(attributes) {
  attrsTable.innerHTML = "";

  attributes.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = `attr-row${item.needs_review ? " needs-review" : ""}`;
    row.style.animationDelay = `${index * 60}ms`;
    row.dataset.attribute = item.attribute;

    const valueHtml = item.value
      ? `<span class="attr-value" data-role="value">${escapeHtml(item.value)}</span>`
      : `<span class="attr-value empty" data-role="value">не найдено — заполните вручную</span>`;

    const confidenceClass = item.needs_review ? "warn" : "ok";
    const confidenceLabel = item.value
      ? formatConfidence(item.confidence)
      : "0,00";

    row.innerHTML = `
      <div class="attr-name">${escapeHtml(item.attribute)}</div>
      <div>${valueHtml}</div>
      <div class="confidence" data-role="status">
        <div class="confidence-meta">
          <span>Уверенность</span>
          <span class="${confidenceClass}">${confidenceLabel}</span>
        </div>
        <div class="bar"><i style="width: 0%"></i></div>
      </div>
      <button type="button" class="btn-edit-attr" data-role="attr-action" data-mode="edit" aria-label="Править атрибут ${escapeHtml(item.attribute)}">
        Править
      </button>
    `;

    attrsTable.appendChild(row);

    requestAnimationFrame(() => {
      const bar = row.querySelector(".bar > i");
      if (bar) bar.style.width = `${Math.round((item.confidence || 0) * 100)}%`;
    });
  });
}

function markAttributeRefined(row) {
  row.classList.remove("needs-review");
  row.classList.add("is-refined");

  const status = row.querySelector('[data-role="status"]');
  if (status) {
    status.className = "attr-refined";
    status.textContent = "Атрибут уточнен";
  }
}

function setActionButton(btn, mode, attributeName) {
  btn.dataset.mode = mode;
  if (mode === "save") {
    btn.classList.add("is-save");
    btn.textContent = "Сохранить";
    btn.setAttribute("aria-label", `Сохранить атрибут ${attributeName}`);
  } else {
    btn.classList.remove("is-save");
    btn.textContent = "Править";
    btn.setAttribute("aria-label", `Править атрибут ${attributeName}`);
  }
}

function startEditAttribute(row) {
  const valueNode = row.querySelector('[data-role="value"]');
  if (!valueNode || valueNode.tagName === "INPUT") return;

  const actionBtn = row.querySelector('[data-role="attr-action"]');
  const attributeName = row.dataset.attribute || "";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "attr-edit-input";
  input.value = valueNode.classList.contains("empty") ? "" : valueNode.textContent;
  input.placeholder = "Введите каноническое значение";
  input.setAttribute("data-role", "value");

  let settled = false;

  const cancelEdit = () => {
    if (settled) return;
    settled = true;
    input.replaceWith(valueNode);
    setActionButton(actionBtn, "edit", attributeName);
  };

  const saveEdit = () => {
    if (settled) return;

    const next = input.value.trim();
    if (!next) {
      input.focus();
      showToast("Введите значение атрибута");
      return;
    }

    settled = true;
    const span = document.createElement("span");
    span.className = "attr-value";
    span.setAttribute("data-role", "value");
    span.textContent = next;
    input.replaceWith(span);
    markAttributeRefined(row);
    setActionButton(actionBtn, "edit", attributeName);
  };

  row._saveEdit = saveEdit;
  row._cancelEdit = cancelEdit;

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveEdit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    }
  });

  valueNode.replaceWith(input);
  setActionButton(actionBtn, "save", attributeName);
  input.focus();
  input.select();
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function showToast(message) {
  toast.hidden = false;
  toast.textContent = message;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.hidden = true;
  }, 2800);
}

async function extractCard() {
  const title = titleInput.value.trim();
  const description = descriptionInput.value.trim();

  if (!title) {
    titleInput.focus();
    return;
  }

  await playLoading();

  const started = Date.now();
  let data;

  try {
    const response = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });

    if (!response.ok) {
      throw new Error(`Ошибка API: ${response.status}`);
    }

    data = await response.json();
  } catch (error) {
    showScreen("input");
    showToast(error.message || "Не удалось обработать карточку");
    return;
  }

  const elapsed = Date.now() - started;
  if (elapsed < 900) {
    await sleep(900 - elapsed);
  }

  categoryLabel.textContent = data.category_label || "Категория";
  resultTitle.textContent = data.title;
  resultDescription.textContent = data.description || "Описание не указано";
  renderAttributes(data.attributes || []);
  showScreen("result");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  extractCard();
});

titleInput.addEventListener("input", () => {
  updateCharCount(titleInput, titleCount, TITLE_LIMIT);
});
descriptionInput.addEventListener("input", () => {
  updateCharCount(descriptionInput, descriptionCount, DESCRIPTION_LIMIT);
});

document.querySelectorAll("[data-example]").forEach((button) => {
  button.addEventListener("click", () => {
    const example = EXAMPLES[button.dataset.example];
    if (!example) return;
    titleInput.value = example.title.slice(0, TITLE_LIMIT);
    descriptionInput.value = example.description.slice(0, DESCRIPTION_LIMIT);
    updateCharCount(titleInput, titleCount, TITLE_LIMIT);
    updateCharCount(descriptionInput, descriptionCount, DESCRIPTION_LIMIT);
    titleInput.focus();
  });
});

document.getElementById("btn-again").addEventListener("click", () => {
  showScreen("input");
  toast.hidden = true;
});

attrsTable.addEventListener("click", (event) => {
  const actionBtn = event.target.closest('[data-role="attr-action"]');
  if (!actionBtn) return;
  const row = actionBtn.closest(".attr-row");
  if (!row) return;

  if (actionBtn.dataset.mode === "save") {
    row._saveEdit?.();
    return;
  }

  startEditAttribute(row);
});

updateCharCount(titleInput, titleCount, TITLE_LIMIT);
updateCharCount(descriptionInput, descriptionCount, DESCRIPTION_LIMIT);
showScreen("input");
