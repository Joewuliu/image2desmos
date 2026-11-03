# Image2Desmos

Upload an image and get a Desmos graph that reconstructs it from mathematical equations.

All image processing and curve generation is deterministic: traditional computer vision (OpenCV, NumPy) and curve fitting (NumPy/SciPy). No AI, machine learning, pretrained models, or image-generation APIs are used to interpret images or produce equations.

It is built for black-and-white line art. Color images and photographs are not supported yet.

## Features

- Upload a PNG or JPEG by drag and drop or file picker, with server-side validation. Images are processed in memory and never stored.
- Follow the image through an interactive pipeline: Source, Edges, Contours, Curves, Graph, with live counts at each stage.
- Tune edge sensitivity, blur, simplification, fitting accuracy and minimum contour size, with results updating as you go.
- Fit contours with lines, circles and piecewise cubic Béziers, shown with their errors.
- Plot real equations in an embedded Desmos Graphing Calculator, framed to the image.
- Read the equations typeset and colour-coded by contour. Selecting an equation highlights its curve, and clicking a curve on the Curves or Graph stage selects its equation.
- Copy all expressions, download them as text, save the calculator state as JSON, reopen a saved state, or download a PNG of the graph.
- Undo Remove and Reset all for 10 seconds, retry a failed trace, and keep the current image if a replacement is rejected.
- Use it on desktop, tablet or phone, with collapsible sidebars. Below 640 px they become sheets under the graph.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, KaTeX, Vitest
- Backend: Python, FastAPI, pytest
- Image processing and fitting: OpenCV, NumPy, SciPy, Pillow
- Graph rendering: Desmos Graphing Calculator API (v1.11)

## Layout

```
image2desmos/
├── frontend/   React + Vite + TypeScript app (deployed on Vercel)
├── backend/    FastAPI service (deployed on Render)
│   ├── app/
│   │   ├── processing/   pure image-processing functions (no web code)
│   │   ├── fitting/      lines, circles and Bézier fitting (pure NumPy/SciPy)
│   │   ├── desmos/       fitted segments -> Desmos LaTeX (pure functions)
│   │   ├── routers/      HTTP endpoints
│   │   └── services/     upload reading and validation
│   └── tests/            pytest suite
├── render.yaml Render service definition
├── DESIGN.md   visual design system
├── PRODUCT.md  product context
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

The live graph needs a Desmos API key; see [Desmos API key](#desmos-api-key). The frontend expects the backend on port 8001; see [Configuration](#configuration) to change that.

Other scripts: `npm run build`, `npm run lint`, `npm test`.

## API

`POST /api/upload` accepts `multipart/form-data` with a single `file` field (PNG or JPEG). The format is detected from the file's contents, not its name or declared type. Limits: 10 MB and 25 megapixels. Uploads stay in memory and are never written to disk. On success it returns image metadata (filename, format, dimensions, pixel count, size, alpha). Errors return `{"detail": {"code": "...", "message": "..."}}` with status 400, 413, 415, 422, 500, 503 (busy) or 504 (timed out).

`POST /api/process` takes the same `file` field (same validation and limits) plus optional form fields:

| Field | Range | Default | Meaning |
| --- | --- | --- | --- |
| `edge_sensitivity` | 0-100 | 50 | Lower Canny thresholds as it rises |
| `blur_sigma` | 0-5 | 1 | Gaussian sigma in pixels (0 disables) |
| `simplify` | 0-10 | 2 | `approxPolyDP` strength, scaled to image size (0 disables) |
| `fit_tolerance` | 0.5-5 | 1 | Target maximum distance, in pixels, between a fitted curve and the traced outline |
| `min_contour_size` | 0-20 | 1 | Drop strokes whose longest side is below this percentage of the image's longest side (affects curves only) |

The pipeline is: decode (transparency onto white) -> grayscale -> downscale to at most 1600 px -> Gaussian blur -> Canny -> `findContours` -> drop specks -> `approxPolyDP` -> Cartesian conversion. It is deterministic: the same input and parameters always give the same output.

The response contains `contours`, `curves`, `fit`, `desmos`, `stats` (contour and point counts, thresholds used), `bounds`, a real `edge_image` (PNG data URL) and `warnings` (for example `no_contours` for a blank image). Images that would produce too much detail (more than 60,000 simplified points, 150,000 traced points or 20,000 segments) are rejected with `too_complex`.

### Curve fitting

Curves are fitted to the dense edge trace, not to the simplified polygons. For each stroke:

1. An open edge (a line, an arc, or an outline with a gap) is traced out and back by OpenCV, so the trace mirrors itself around each end; such strokes stay **open**. Closed edge loops stay **closed**, and an open stroke whose ends are within 5 pixels is closed again.
2. A closed stroke that is accurately a full circle (least-squares fit, refined with SciPy) becomes one `circle`.
3. Otherwise the stroke is cut at sharp corners, so corners are never rounded off.
4. Each piece becomes a `line` if one is within tolerance, else an adaptive piecewise cubic `bezier` (Schneider's algorithm: least-squares fit, Newton reparameterisation, split at the worst point with a shared tangent).

Segments share end points exactly, so curves have no gaps. `curves[].segments[]` holds `type`, `points` (line: 2 points; Bézier: start, two control points, end) or `center` and `radius` (circle), and `max_error`. `fit` holds the segment counts per type and the maximum and mean error (in units and pixels). Errors are measured against the unsmoothed pixel trace. Fitting uses 65% of `fit_tolerance` to leave room for pixel quantisation, so the reported error normally stays near the requested tolerance. Thick strokes appear as two outlines, and filled shapes as their outlines, because Canny finds edges rather than fills.

### Desmos expressions

`desmos.expressions` lists one expression per fitted segment, in plot order, each with an `id`, `latex`, `type`, source `curve` and `segment`. Text is deterministic (numbers use at most 5 decimals, no exponents).

| Segment | Expression |
| --- | --- |
| line | `\left(3t+1,-4t+2\right)\left\{0\le t\le1\right\}`: start point plus the direction vector times `t`, restricted to `0 <= t <= 1` |
| cubic Bézier | `\left(-3t^3+5,2t\right)\left\{0\le t\le1\right\}`: the Bernstein form expanded to a polynomial in `t`, restricted to `0 <= t <= 1` |
| circle | `\left(x-1\right)^2+\left(y+2\right)^2=3^2` |

Segments with zero length or non-finite values are skipped, not emitted. They are counted in `desmos.skipped` and `desmos.skipped_count`.

### Coordinate system

Contour points are Cartesian: the origin is the image centre, x points right, y points **up** (the image y axis is flipped), and the longest image side spans 20 units (so x is within -10..10 for landscape images). `bounds` gives the exact rectangle the image covers. Fitted curves use the same coordinates.

## Exporting

The Export section sits at the foot of the right sidebar once a result exists. On phones it is a bar under the equation list that opens.

| Export | Needs the Desmos key | What it is |
| --- | --- | --- |
| Copy Expressions | no | Every expression as Desmos LaTeX, one per line, on the clipboard. |
| Download expressions (`.txt`) | no | The same text as a file. |
| Export state JSON | yes | The output of the Desmos API's `getState()`, to reopen in this app. |
| Import state JSON | yes | Validates the file, then calls `setState()`. The list shows the state's own expressions, tuning is locked, and "Restore generated graph" returns to the computed ones. Saved states can also be opened from the empty screen, in a Graph-only view. |
| Download PNG | yes | A screenshot of the Desmos graph (`asyncScreenshot`, 2x resolution). |

### Export limitations

- **State JSON is not a Desmos graph link or a native Desmos file.** It is meant to be reopened in this app. Use Copy Expressions or the `.txt` to move equations into Desmos.
- **Graph-link generation is not implemented.**
- **Colours do not carry over.** Pasting into a Desmos expression line creates one expression per line, but Desmos assigns its own colours.
- **Copying and downloading are unavailable while a trace is updating**, so old equations cannot be taken by mistake.
- **Imported states are checked lightly.** A file must be JSON with an `expressions.list` array and at most 25 MB. Desmos may still refuse a valid-looking state, which is reported as an error.
- **Large graphs are slower.** Above 1,500 expressions the graph asks before rendering, and exports may take a few seconds. The list shows 200 rows at a time.

The calculator stays loaded across pipeline stages, so exports work from any stage. If it has not drawn yet, the action opens the Graph stage and runs when it is ready.

## Desmos API key

The live graph uses the official Desmos Graphing Calculator API, which needs a key (request one at <https://www.desmos.com/my-api>). Never commit it.

```bash
cd frontend
cp .env.example .env.local      # Windows PowerShell: Copy-Item .env.example .env.local
# edit .env.local and set VITE_DESMOS_API_KEY=your-key
npm run dev                     # restart so Vite picks up the change
```

Without a key the live graph, state export and import, and PNG download are unavailable, and the Graph stage says so. Every other stage, the equation list, Copy Expressions and the `.txt` download still work. Vite embeds `VITE_*` variables in the built JavaScript, so a key used in a deployed build is visible to visitors. Restrict it to your domain in the Desmos dashboard.

## Configuration

### Frontend

`VITE_*` values are fixed when the frontend is built, so changing one needs a new build. Locally they come from `frontend/.env.local`; copy `frontend/.env.example` to start. `.env.*` files are ignored by Git, apart from `.env.example`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:8001` | Backend address, with no trailing slash. |
| `VITE_DESMOS_API_KEY` | none | Desmos API key. Without it the live graph is unavailable. |

`npm run build` prints a warning if either is missing.

### Backend

All are optional for local development.

| Variable | Default | Purpose |
| --- | --- | --- |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated frontend origins. `*` is refused at startup. |
| `CORS_ORIGIN_REGEX` | none | Optional pattern for extra origins, such as preview deployments. |
| `MAX_CONCURRENT_JOBS` | `1` | Traces that run at the same time. |
| `MAX_QUEUED_JOBS` | `4` | Traces that may wait; beyond this requests get 503. |
| `JOB_QUEUE_SECONDS` | `30` | Longest wait for a free slot. |
| `JOB_TIMEOUT_SECONDS` | `60` | Longest a trace may run before it gets 504. |

## Deployment

The frontend is a static build on Vercel and the backend is a web service on Render. Deploy the backend first, because the frontend build needs its address.

### 1. Render (backend)

`render.yaml` defines the service, including Python 3.13.15, the start command and the `/health` check.

1. In the Render Dashboard choose **New > Blueprint** and connect the repository.
2. When asked for `CORS_ORIGINS`, enter a placeholder such as `https://example.com`; step 3 sets the real value.
3. Apply the Blueprint, wait for the deploy, and copy the service URL, such as `https://image2desmos-api.onrender.com`.
4. Open `<service URL>/health`. It should return `{"status":"ok"}`.

To create it by hand instead, make a **Web Service** with these settings:

| Setting | Value |
| --- | --- |
| Runtime | Python 3 |
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1 --limit-concurrency 12` |
| Health Check Path | `/health` |
| Environment | `PYTHON_VERSION=3.13.15`, `CORS_ORIGINS`, `OMP_NUM_THREADS=1`, `OPENBLAS_NUM_THREADS=1`, `MALLOC_ARENA_MAX=2` |

### 2. Vercel (frontend)

1. In Vercel choose **Add New > Project** and import the repository.
2. Set **Root Directory** to `frontend`. Vercel detects Vite, so the build settings can stay as they are: `npm run build`, output `dist`. No `vercel.json` is needed, because the app is a single page with no client-side routes.
3. Add these environment variables for Production and Preview:
   - `VITE_API_URL`: the Render service URL, with no trailing slash
   - `VITE_DESMOS_API_KEY`: your Desmos key
4. Deploy, and copy the production URL, such as `https://image2desmos.vercel.app`.

### 3. Connect them

1. In Render, set `CORS_ORIGINS` to the exact Vercel URL, with `https://` and no trailing slash. Add any custom domain after a comma. Saving restarts the service.
2. To allow Vercel preview deployments, also set `CORS_ORIGIN_REGEX`, for example `https://image2desmos-.*\.vercel\.app`. Keep the pattern specific to your project.
3. In your Desmos dashboard, restrict the key to your domain. It is embedded in the built JavaScript, so visitors can see it. Trial keys show a notice and are not for commercial use.

If you later change `VITE_API_URL` or `VITE_DESMOS_API_KEY`, redeploy on Vercel so a new build picks it up. Changes to `render.yaml` environment values marked `sync: false` are not applied from the file; edit those in the Render Dashboard.

### Running on the free plan

- The free plan has 0.1 CPU and 512 MB of memory, and it spins down after 15 minutes without traffic. The first request after that can take about a minute.
- The service runs one trace at a time. Others wait in a short queue, and when it is full users see a "busy" message with their work intact.
- Peak memory for a worst-case 25-megapixel image was about 300 MB when measured on Windows. The real figure on Render may differ, so check the service's metrics after deploying.
- Requests are capped at 10 MB, refused before they are parsed. Images are shrunk while decoding, and traces stop at their time limit. There is no per-visitor rate limit.
- Traces take longer at 0.1 CPU. If `504` responses become common, raise `JOB_TIMEOUT_SECONDS` or move to a larger plan and raise `MAX_CONCURRENT_JOBS`.
