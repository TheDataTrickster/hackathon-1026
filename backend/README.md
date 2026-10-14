# Backend — прототип извлечения атрибутов

## Запуск

Из корня репозитория:

```bash
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --app-dir backend --reload --port 8000
```

Или:

```bash
.venv/bin/uvicorn main:app --reload --port 8000 --app-dir backend
```

Откройте http://127.0.0.1:8000

## API

`POST /api/extract`

```json
{
  "title": "Смартфон Samsung Galaxy S24 256 ГБ чёрный",
  "description": "Диагональ 6,2 дюйма, батарея 4000 мАч"
}
```

Ответ: `title`, `description`, `category_label`, `attributes[{attribute, value, confidence, needs_review}]`.
