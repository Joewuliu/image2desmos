# Image2Desmos

Upload an image and get a Desmos graph that reconstructs it from mathematical equations.

All image processing and curve generation is deterministic: traditional computer vision (OpenCV, NumPy) and curve fitting (NumPy/SciPy). No AI, machine learning, pretrained models, or image-generation APIs are used to interpret images or produce equations.

The MVP targets black-and-white line art. Color images and photographs come later.

## Status

Milestone 2 (image upload) is complete: drag-and-drop upload with preview, and a validating `POST /api/upload` endpoint. Image processing, curve fitting and Desmos integration are not implemented yet.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, Vitest
- Backend: Python, FastAPI, pytest
- Planned: OpenCV, NumPy, SciPy, Desmos Graphing Calculator API

## Layout

```
image2desmos/
├── frontend/   React + Vite + TypeScript app
├── backend/    FastAPI service
│   ├── app/    application code
│   └── tests/  pytest suite
├── README.md
└── .gitignore
```

## Prerequisites

- Node.js 20+ and npm
- Python 3.11+

## Backend setup

From the repository root.

Windows (PowerShell):

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8001
```

macOS / Linux:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8001
```

Check it: <http://localhost:8001/health> returns `{"status":"ok"}`. Interactive docs are at <http://localhost:8001/docs>.

Run tests (venv active): `pytest`

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The app runs at <http://localhost:5173>.

Other scripts: `npm run build`, `npm run lint`, `npm test`.

## API

`POST /api/upload` accepts `multipart/form-data` with a single `file` field (PNG or JPEG). The format is detected from the file's contents, not its name or declared type. Limits: 10 MB and 25 megapixels. Uploads are validated in memory and never written to disk. On success it returns image metadata (filename, format, dimensions, pixel count, size, alpha). Errors return `{"detail": {"code": "...", "message": "..."}}` with status 400, 413, 415 or 422.

## Configuration

The frontend reads the API address from `VITE_API_URL` (default `http://localhost:8001`). To override it, copy `frontend/.env.example` to `frontend/.env.local`.

The backend allows CORS requests from `http://localhost:5173` and `http://127.0.0.1:5173`. Edit `ALLOWED_ORIGINS` in `backend/app/main.py` to change this. Never commit `.env` files.
