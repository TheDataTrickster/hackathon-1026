/** Rule-based attribute extraction (browser port of backend/extract.py). */

const COLOR_PATTERNS = [
  [/чёрн\w*|черн\w*|black/i, "чёрный", 0.88],
  [/бел\w*|white/i, "белый", 0.88],
  [/серебр\w*|silver/i, "серебристый", 0.88],
  [/сер\w*|gray|grey/i, "серый", 0.85],
  [/син\w*|blue/i, "синий", 0.88],
  [/алы\w*|алого|красн\w*|red/i, "красный", 0.81],
  [/зелён\w*|зелен\w*|green/i, "зелёный", 0.88],
  [/золот\w*|gold/i, "золотой", 0.86],
  [/фиолетов\w*|purple|violet/i, "фиолетовый", 0.86],
];

const BRANDS = [
  "Samsung",
  "Apple",
  "Xiaomi",
  "Huawei",
  "Honor",
  "Realme",
  "OnePlus",
  "Google",
  "Sony",
  "LG",
  "Asus",
  "Lenovo",
  "HP",
  "Dell",
  "Acer",
  "MSI",
  "Nokia",
  "Motorola",
  "Tecno",
  "Infinix",
  "Poco",
  "Redmi",
];

const PHONE_HINTS = ["смартфон", "телефон", "iphone", "galaxy", "pixel", "redmi", "poco"];
const LAPTOP_HINTS = ["ноутбук", "laptop", "macbook", "notebook", "ultrabook"];

function norm(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function findBrand(text) {
  const lower = text.toLowerCase();
  for (const brand of BRANDS) {
    if (lower.includes(brand.toLowerCase())) {
      return [brand, 0.98];
    }
  }
  return [null, 0.0];
}

function findMemory(text) {
  const patterns = [
    [/(\d+)\s*[гg][бb]\s*(?:памяти|storage|rom)?/i, "ГБ"],
    [/(\d+)\s*gb\b/i, "ГБ"],
    [/(\d+)\s*[тt][бb]\b/i, "ТБ"],
  ];
  for (const [pattern, unit] of patterns) {
    const m = text.match(pattern);
    if (m) return [`${m[1]} ${unit}`, 0.95];
  }
  return [null, 0.0];
}

function findScreen(text) {
  const patterns = [
    /(?:диагональ[^\d]{0,16})?(\d+(?:[.,]\d+)?)\s*(?:"|″|’|'|дюйм)/i,
    /(\d+(?:[.,]\d+)?)\s*дюйм/i,
    /экран[^\d]{0,16}(\d+(?:[.,]\d+)?)/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) {
      const value = m[1].replace(",", ".");
      return [`${value} дюйма`, 0.93];
    }
  }
  return [null, 0.0];
}

function findBattery(text) {
  const m = text.match(/(\d{3,5})\s*мАч|(\d{3,5})\s*mAh/i);
  if (m) {
    const mah = m[1] || m[2];
    return [`${mah} мАч`, 0.9];
  }
  return [null, 0.0];
}

function findColor(text) {
  for (const [pattern, canon, confidence] of COLOR_PATTERNS) {
    if (pattern.test(text)) return [canon, confidence];
  }
  return [null, 0.0];
}

function findRam(text) {
  const patterns = [
    /(\d+)\s*[гg][бb]\s*(?:ОЗУ|RAM|оператив\w*)/i,
    /(?:ОЗУ|RAM|оперативн\w*(?:\s*памят\w*)?)[^\d]{0,12}(\d+)\s*[гg][бb]/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) return [`${m[1]} ГБ`, 0.92];
  }
  return [null, 0.0];
}

function findCpu(text) {
  const patterns = [
    /(Intel\s+Core\s+i[3579][-\s]?\d+\w*)/i,
    /(AMD\s+Ryzen\s+\d\s+\d+\w*)/i,
    /(Apple\s+M[1-4](?:\s+(?:Pro|Max|Ultra))?)/i,
    /(Snapdragon\s+\d+\+?)/i,
    /(Dimensity\s+\d+)/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) return [norm(m[1]), 0.94];
  }
  return [null, 0.0];
}

function findStorage(text) {
  const m = text.match(/(?:SSD|HDD|накопител\w*)[^\d]{0,16}(\d+)\s*([гgтt][бb])/i);
  if (m) {
    const unit = /^[tт]/i.test(m[2]) ? "ТБ" : "ГБ";
    const kind = /ssd/i.test(text) ? "SSD" : /hdd/i.test(text) ? "HDD" : "SSD";
    return [`${m[1]} ${unit} ${kind}`, 0.91];
  }
  return findMemory(text);
}

function guessModel(text, brand) {
  if (brand) {
    const pattern = new RegExp(
      `${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+([A-Za-z0-9][A-Za-z0-9+\\- ]{1,40}?)(?=\\s(?:с|с\\s|,|\\.|$|\\d+\\s*[гgтt][бb])|$)`,
      "i",
    );
    const m = text.match(pattern);
    if (m) {
      let model = norm(m[1]);
      model = model.split(
        /\s+(?:чёрн|черн|бел|серебр|сер|син|алы|красн|зел|золот|фиолет|black|white|gray|grey|silver)/i,
      )[0];
      model = norm(model.replace(/^[ ,.-]+|[ ,.-]+$/g, ""));
      if (model && model.length >= 2) return [model, 0.86];
    }
  }

  const m = text.match(
    /(Galaxy\s+[A-Z0-9][A-Za-z0-9+\- ]{0,20}|iPhone\s+\d+[^\s,]{0,12}|Redmi\s+[A-Z0-9][^\s,]{0,16}|Pixel\s+\d+[a-zA-Z]*)/i,
  );
  if (m) return [norm(m[1]), 0.84];
  return [null, 0.0];
}

function detectCategory(text) {
  const lower = text.toLowerCase();
  if (PHONE_HINTS.some((h) => lower.includes(h))) return "smartphone";
  if (LAPTOP_HINTS.some((h) => lower.includes(h))) return "laptop";
  if (findBattery(text)[0] || /\b(ios|android)\b/i.test(lower)) return "smartphone";
  if (findCpu(text)[0] || findRam(text)[0]) return "laptop";
  return "generic";
}

export function extractAttributes(title, description, sellerAttrs = null) {
  title = norm(title);
  description = norm(description);
  let text = `${title}\n${description}`;
  if (sellerAttrs) {
    text +=
      "\n" +
      Object.entries(sellerAttrs)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
  }

  const category = detectCategory(text);
  let extractors;
  let categoryLabel;

  if (category === "smartphone") {
    extractors = [
      ["Бренд", findBrand],
      ["Модель", (t) => guessModel(t, findBrand(t)[0])],
      ["Объём памяти", findMemory],
      ["Диагональ экрана", findScreen],
      ["Ёмкость батареи", findBattery],
      ["Цвет", findColor],
    ];
    categoryLabel = "Смартфоны";
  } else if (category === "laptop") {
    extractors = [
      ["Бренд", findBrand],
      ["Процессор", findCpu],
      ["Объём оперативной памяти", findRam],
      ["Накопитель", findStorage],
      ["Диагональ экрана", findScreen],
      ["Цвет", findColor],
    ];
    categoryLabel = "Ноутбуки";
  } else {
    extractors = [
      ["Бренд", findBrand],
      ["Цвет", findColor],
      ["Диагональ экрана", findScreen],
      ["Объём памяти", findMemory],
    ];
    categoryLabel = "Товары";
  }

  const attributes = extractors.map(([name, fn]) => {
    const [value, confidence] = fn(text);
    if (value) {
      return {
        attribute: name,
        value,
        confidence: Math.round(confidence * 100) / 100,
        needs_review: confidence < 0.85,
      };
    }
    return {
      attribute: name,
      value: null,
      confidence: 0.0,
      needs_review: true,
    };
  });

  return {
    title,
    description,
    category,
    category_label: categoryLabel,
    attributes,
  };
}
