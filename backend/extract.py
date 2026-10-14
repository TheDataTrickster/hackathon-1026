"""Rule-based attribute extraction for the clickable prototype."""

from __future__ import annotations

import re
from typing import Any

COLOR_PATTERNS = [
    (r"чёрн\w*|черн\w*|black", "чёрный", 0.88),
    (r"бел\w*|white", "белый", 0.88),
    (r"серебр\w*|silver", "серебристый", 0.88),
    (r"сер\w*|gray|grey", "серый", 0.85),
    (r"син\w*|blue", "синий", 0.88),
    (r"алы\w*|алого|красн\w*|red", "красный", 0.81),
    (r"зелён\w*|зелен\w*|green", "зелёный", 0.88),
    (r"золот\w*|gold", "золотой", 0.86),
    (r"фиолетов\w*|purple|violet", "фиолетовый", 0.86),
]

BRANDS = [
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
]

PHONE_HINTS = ("смартфон", "телефон", "iphone", "galaxy", "pixel", "redmi", "poco")
LAPTOP_HINTS = ("ноутбук", "laptop", "macbook", "notebook", "ultrabook")


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _find_brand(text: str) -> tuple[str | None, float]:
    lower = text.lower()
    for brand in BRANDS:
        if brand.lower() in lower:
            return brand, 0.98
    return None, 0.0


def _find_memory(text: str) -> tuple[str | None, float]:
    patterns = [
        (r"(\d+)\s*[гg][бb]\s*(?:памяти|storage|rom)?", "ГБ"),
        (r"(\d+)\s*gb\b", "ГБ"),
        (r"(\d+)\s*[тt][бb]\b", "ТБ"),
    ]
    for pattern, unit in patterns:
        m = re.search(pattern, text, flags=re.IGNORECASE)
        if m:
            return f"{m.group(1)} {unit}", 0.95
    return None, 0.0


def _find_screen(text: str) -> tuple[str | None, float]:
    patterns = [
        r'(?:диагональ[^\d]{0,16})?(\d+(?:[.,]\d+)?)\s*(?:"|″|’|\'|дюйм)',
        r"(\d+(?:[.,]\d+)?)\s*дюйм",
        r"экран[^\d]{0,16}(\d+(?:[.,]\d+)?)",
    ]
    for pattern in patterns:
        m = re.search(pattern, text, flags=re.IGNORECASE)
        if m:
            value = m.group(1).replace(",", ".")
            return f"{value} дюйма", 0.93
    return None, 0.0


def _find_battery(text: str) -> tuple[str | None, float]:
    m = re.search(r"(\d{3,5})\s*мАч|(\d{3,5})\s*mAh", text, flags=re.IGNORECASE)
    if m:
        mah = m.group(1) or m.group(2)
        return f"{mah} мАч", 0.9
    return None, 0.0


def _find_color(text: str) -> tuple[str | None, float]:
    for pattern, canon, confidence in COLOR_PATTERNS:
        if re.search(pattern, text, flags=re.IGNORECASE):
            return canon, confidence
    return None, 0.0


def _find_ram(text: str) -> tuple[str | None, float]:
    patterns = [
        r"(\d+)\s*[гg][бb]\s*(?:ОЗУ|RAM|оператив\w*)",
        r"(?:ОЗУ|RAM|оперативн\w*(?:\s*памят\w*)?)[^\d]{0,12}(\d+)\s*[гg][бb]",
    ]
    for pattern in patterns:
        m = re.search(pattern, text, flags=re.IGNORECASE)
        if m:
            return f"{m.group(1)} ГБ", 0.92
    return None, 0.0


def _find_cpu(text: str) -> tuple[str | None, float]:
    patterns = [
        r"(Intel\s+Core\s+i[3579][-\s]?\d+\w*)",
        r"(AMD\s+Ryzen\s+\d\s+\d+\w*)",
        r"(Apple\s+M[1-4](?:\s+(?:Pro|Max|Ultra))?)",
        r"(Snapdragon\s+\d+\+?)",
        r"(Dimensity\s+\d+)",
    ]
    for pattern in patterns:
        m = re.search(pattern, text, flags=re.IGNORECASE)
        if m:
            return _norm(m.group(1)), 0.94
    return None, 0.0


def _find_storage(text: str) -> tuple[str | None, float]:
    m = re.search(
        r"(?:SSD|HDD|накопител\w*)[^\d]{0,16}(\d+)\s*([гgтt][бb])",
        text,
        flags=re.IGNORECASE,
    )
    if m:
        unit = "ТБ" if m.group(2).lower().startswith(("t", "т")) else "ГБ"
        kind = "SSD" if re.search(r"ssd", text, re.I) else ("HDD" if re.search(r"hdd", text, re.I) else "SSD")
        return f"{m.group(1)} {unit} {kind}", 0.91
    return _find_memory(text)


def _detect_category(text: str) -> str:
    lower = text.lower()
    if any(h in lower for h in PHONE_HINTS):
        return "smartphone"
    if any(h in lower for h in LAPTOP_HINTS):
        return "laptop"
    if _find_battery(text)[0] or re.search(r"\b(ios|android)\b", lower):
        return "smartphone"
    if _find_cpu(text)[0] or _find_ram(text)[0]:
        return "laptop"
    return "generic"


def extract_attributes(title: str, description: str, seller_attrs: dict[str, str] | None = None) -> dict[str, Any]:
    title = _norm(title)
    description = _norm(description)
    text = f"{title}\n{description}"
    if seller_attrs:
        text += "\n" + "\n".join(f"{k}: {v}" for k, v in seller_attrs.items() if v)

    category = _detect_category(text)
    extractors: list[tuple[str, Any]]
    if category == "smartphone":
        extractors = [
            ("Бренд", _find_brand),
            ("Модель", lambda t: _guess_model(t, _find_brand(t)[0])),
            ("Объём памяти", _find_memory),
            ("Диагональ экрана", _find_screen),
            ("Ёмкость батареи", _find_battery),
            ("Цвет", _find_color),
        ]
        category_label = "Смартфоны"
    elif category == "laptop":
        extractors = [
            ("Бренд", _find_brand),
            ("Процессор", _find_cpu),
            ("Объём оперативной памяти", _find_ram),
            ("Накопитель", _find_storage),
            ("Диагональ экрана", _find_screen),
            ("Цвет", _find_color),
        ]
        category_label = "Ноутбуки"
    else:
        extractors = [
            ("Бренд", _find_brand),
            ("Цвет", _find_color),
            ("Диагональ экрана", _find_screen),
            ("Объём памяти", _find_memory),
        ]
        category_label = "Товары"

    attributes = []
    for name, fn in extractors:
        value, confidence = fn(text)
        if value:
            attributes.append(
                {
                    "attribute": name,
                    "value": value,
                    "confidence": round(confidence, 2),
                    "needs_review": confidence < 0.85,
                }
            )
        else:
            attributes.append(
                {
                    "attribute": name,
                    "value": None,
                    "confidence": 0.0,
                    "needs_review": True,
                }
            )

    return {
        "title": title,
        "description": description,
        "category": category,
        "category_label": category_label,
        "attributes": attributes,
    }


def _guess_model(text: str, brand: str | None) -> tuple[str | None, float]:
    if brand:
        pattern = rf"{re.escape(brand)}\s+([A-Za-z0-9][A-Za-z0-9+\- ]{{1,40}}?)(?=\s(?:с|с\s|,|\.|$/|\d+\s*[гgтt][бb])|$)"
        m = re.search(pattern, text, flags=re.IGNORECASE)
        if m:
            model = _norm(m.group(1))
            model = re.split(
                r"\s+(?:чёрн|черн|бел|серебр|сер|син|алы|красн|зел|золот|фиолет|black|white|gray|grey|silver)",
                model,
                maxsplit=1,
                flags=re.I,
            )[0]
            model = _norm(model.strip(" ,.-"))
            if model and len(model) >= 2:
                return model, 0.86

    m = re.search(r"(Galaxy\s+[A-Z0-9][A-Za-z0-9+\- ]{0,20}|iPhone\s+\d+[^\s,]{0,12}|Redmi\s+[A-Z0-9][^\s,]{0,16}|Pixel\s+\d+[a-zA-Z]*)", text, flags=re.I)
    if m:
        return _norm(m.group(1)), 0.84
    return None, 0.0
