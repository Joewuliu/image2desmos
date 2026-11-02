# Image2Desmos

Upload an image and get a Desmos graph that reconstructs it from mathematical equations.

All image processing and curve generation is deterministic: traditional computer vision (OpenCV, NumPy) and curve fitting (NumPy/SciPy). No AI, machine learning, pretrained models, or image-generation APIs are used to interpret images or produce equations.

The MVP targets black-and-white line art. Color images and photographs come later.

## Status

- Milestone 2 (upload): drag-and-drop upload with preview, validated server-side.
- Milestone 3 (processing): grayscale, Gaussian blur, Canny edges, contour extraction and simplification, with live controls and an edge/contour preview.

- Milestone 4 (curve fitting): contours are fitted with lines, circles and piecewise cubic Bézier curves; a Curves tab previews them over the image.

- Milestone 5 (Desmos): every fitted segment is serialised to a Desmos expression, plotted live in an embedded Desmos Graphing Calculator and listed (with copy) in an Equations tab.

- Milestone 6A (export): download the expressions as `.txt`, export and re-import the Desmos calculator state as JSON, and save a PNG of the graph.

Graph-link generation and native Desmos file import are not implemented.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, Vitest
- Backend: Python, FastAPI, pytest
- Image processing and fitting: OpenCV, NumPy, SciPy, Pillow
- Graph rendering: Desmos Graphing Calculator API (v1.11) Graphing Calculator API

## Layout

```
image2desmos/
├── frontend/   React + Vite + TypeScript app
├── backend/    FastAPI service
│   ├── app/
│   │   ├── processing/   pure image-processing functions (no web code)
│   │   ├── fitting/      lines, circles and Bézier fitting (pure NumPy/SciPy)
│   │   ├── desmos/       fitted segments -> Desmos LaTeX (pure functions)
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
| `fit_tolerance` | 0.5-5 | 1 | Target maximum distance, in pixels, between a fitted curve and the traced outline |
| `min_contour_size` | 0-20 | 1 | Drop strokes whose longest side is below this percentage of the image's longest side (affects curves only) |

The pipeline is: decode (transparency onto white) -> grayscale -> downscale to at most 1600 px -> Gaussian blur -> Canny -> `findContours` -> drop specks -> `approxPolyDP` -> Cartesian conversion. It is deterministic: the same input and parameters always give the same output.

The response contains `contours`, `stats` (contour and point counts, thresholds used), `bounds`, a real `edge_image` (PNG data URL) and `warnings` (for example `no_contours` for a blank image). Images that would produce more than 60,000 points are rejected with `too_complex`.

### Curve fitting

Curves are fitted to the dense edge trace, not to the simplified polygons. For each stroke:

1. An open edge (a line or arc) is traced out and back by OpenCV, so pixels visited once mark its ends; such strokes stay **open**. Closed edge loops stay **closed**.
2. A closed stroke that is accurately a full circle (least-squares fit, refined with SciPy) becomes one `circle`.
3. Otherwise the stroke is cut at sharp corners, so corners are never rounded off.
4. Each piece becomes a `line` if one is within tolerance, else an adaptive piecewise cubic `bezier` (Schneider's algorithm: least-squares fit, Newton reparameterisation, split at the worst point with a shared tangent).

Segments share end points exactly, so curves have no gaps. `curves[].segments[]` holds `type`, `points` (line: 2 points; Bézier: start, two control points, end) or `center` and `radius` (circle), and `max_error`. `fit` holds the segment counts per type and the maximum and mean error (in units and pixels). Errors are measured against the unsmoothed pixel trace. Fitting uses 65% of `fit_tolerance` to leave room for pixel quantisation, so the reported error normally stays near the requested tolerance. Thick strokes appear as two outlines because Canny finds both edges of a stroke.

### Desmos expressions

`desmos.expressions` lists one expression per fitted segment, in plot order, each with an `id`, `latex`, `type` and source `curve`. Text is deterministic (numbers use at most 5 decimals, no exponents).

| Segment | Expression |
| --- | --- |
| line | `\left(3t+1,-4t+2\right)\left\{0\le t\le1\right\}`: start point plus the direction vector times `t`, restricted to `0 <= t <= 1` |
| cubic Bézier | `\left(-3t^3+5,2t\right)\left\{0\le t\le1\right\}`: the Bernstein form expanded to a polynomial in `t`, restricted to `0 <= t <= 1` |
| circle | `\left(x-1\right)^2+\left(y+2\right)^2=3^2` |

Segments with zero length or non-finite values are skipped, not emitted. They are counted in `desmos.skipped` and `desmos.skipped_count`.

### Coordinate system

Contour points are Cartesian: the origin is the image centre, x points right, y points **up** (the image y axis is flipped), and the longest image side spans 20 units (so x is within -10..10 for landscape images). `bounds` gives the exact rectangle the image covers. Fitted curves use the same coordinates.

## Exporting

The Export section appears under the preview once a result exists.

| Export | Needs the Desmos key | What it is |
| --- | --- | --- |
| Expressions `.txt` | no | Every equation as Desmos LaTeX, one per line, to paste into a Desmos graph. |
| Desmos state `.json` | yes | The output of the Desmos API's `getState()`. A backup you can re-import into Image2Desmos. |
| Import state `.json` | yes | Validates the file, then calls `setState()`. "Restore generated graph" returns to the computed equations. |
| Graph image `.png` | yes | A screenshot of the Desmos graph (`asyncScreenshot`, 2x resolution). |

**The state JSON is not a Desmos graph link or a native Desmos file.** Desmos treats states as opaque and has no import for these files on desmos.com. Export and import happen inside this app; use the `.txt` to move equations into the Desmos site. Import checks the file is a JSON object with an `expressions.list` array and is at most 25 MB; Desmos may still reject a state from another calculator version, which is reported as an error.

Actions that need the calculator open the Desmos tab by themselves and run when the graph has drawn. Graphs above 1,500 expressions ask for confirmation before rendering.

## Desmos API key

The live graph uses the official Desmos Graphing Calculator API, which needs a key (request one at <https://www.desmos.com/my-api>). Never commit it.

```bash
cd frontend
cp .env.example .env.local      # Windows PowerShell: Copy-Item .env.example .env.local
# edit .env.local and set VITE_DESMOS_API_KEY=your-key
npm run dev                     # restart so Vite picks up the change
```

Without a key the Desmos tab explains how to add one; everything else, including the Equations tab and Copy Expressions, still works. Vite embeds `VITE_*` variables in the built JavaScript, so a key used in a deployed build is visible to visitors. Restrict it to your domain in the Desmos dashboard.

## Configuration

The frontend reads the API address from `VITE_API_URL` (default `http://localhost:8001`). To override it, copy `frontend/.env.example` to `frontend/.env.local`.

The backend allows CORS requests from `http://localhost:5173` and `http://127.0.0.1:5173`. Edit `ALLOWED_ORIGINS` in `backend/app/main.py` to change this. Never commit `.env` files.
