# Image2Desmos

Upload an image and get a Desmos graph that reconstructs it from mathematical equations.

All image processing and curve generation is deterministic: traditional computer vision (OpenCV, NumPy) and curve fitting (NumPy/SciPy). No AI, machine learning, pretrained models, or image-generation APIs are used to interpret images or produce equations.

The MVP targets black-and-white line art. Color images and photographs come later.

## Status

- Milestone 2 (upload): drag-and-drop upload with preview, validated server-side.
- Milestone 3 (processing): grayscale, Gaussian blur, Canny edges, contour extraction and simplification, with live controls and an edge/contour preview.

Curve fitting and Desmos integration are not implemented yet.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, Vitest
- Backend: Python, FastAPI, pytest
- Image processing: OpenCV, NumPy, Pillow
- Planned: SciPy, Desmos Graphing Calculator API

## Layout

```
image2desmos/
├── frontend/   React + Vite + TypeScript app
├── backend/    FastAPI service
│   ├── app/
│   │   ├── processing/   pure image-processing functions (no web code)
│   │   ├── routers/      HTTP endpoints
│   │   └── services/     upload reading and validation
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

`POST /api/process` takes the same `file` field (same validation and limits) plus optional form fields:

| Field | Range | Default | Meaning |
| --- | --- | --- | --- |
| `edge_sensitivity` | 0-100 | 50 | Lower Canny thresholds as it rises |
| `blur_sigma` | 0-5 | 1 | Gaussian sigma in pixels (0 disables) |
| `simplify` | 0-10 | 2 | `approxPolyDP` strength, scaled to image size (0 disables) |

The pipeline is: decode (transparency onto white) -> grayscale -> downscale to at most 1600 px -> Gaussian blur -> Canny -> `findContours` -> drop specks -> `approxPolyDP` -> Cartesian conversion. It is deterministic: the same input and parameters always give the same output.

The response contains `contours`, `stats` (contour and point counts, thresholds used), `bounds`, a real `edge_image` (PNG data URL) and `warnings` (for example `no_contours` for a blank image). Images that would produce more than 60,000 points are rejected with `too_complex`.

### Coordinate system

Contour points are Cartesian: the origin is the image centre, x points right, y points **up** (the image y axis is flipped), and the longest image side spans 20 units (so x is within -10..10 for landscape images). `bounds` gives the exact rectangle the image covers.

## Configuration

The frontend reads the API address from `VITE_API_URL` (default `http://localhost:8001`). To override it, copy `frontend/.env.example` to `frontend/.env.local`.

The backend allows CORS requests from `http://localhost:5173` and `http://127.0.0.1:5173`. Edit `ALLOWED_ORIGINS` in `backend/app/main.py` to change this. Never commit `.env` files.
