# Product

## Platform

web

## Users

Desmos art makers: students and hobbyists who want a drawing to exist as real equations in a graph, for art contests or for the pleasure of it. They know what a parametric equation is, or want to learn, and they already use the Desmos calculator. They work at a desktop or laptop, moving between tuning a trace and inspecting the result.

## Product Purpose

Image2Desmos turns uploaded black-and-white line art into a Desmos graph that reconstructs the image with actual mathematical equations. Success is a graph that is recognisably the drawing, made of equations the user can inspect, copy and paste into Desmos.

## Positioning

The result is mathematics, not a traced picture: every stroke becomes lines, circles and cubic Bézier curves that plot in a real Desmos calculator. When accuracy and equation count conflict, the product favours being faithful to the drawing, and the user can loosen the fit.

## Operating Context

The user uploads an image, adjusts tracing and fitting controls, compares each processing stage (source, edges, contours, curves, graph), inspects equations, then copies or exports them. Results update live as controls change. The live graph needs the user's own Desmos API key; the rest of the app works without one.

## Capabilities and Constraints

- PNG and JPEG upload, up to 10 MB and 25 megapixels.
- Grayscale, Gaussian blur, Canny edges, contour extraction, adaptive curve fitting.
- Lines and cubic Béziers serialise as parametric expressions; fitted circles as circle equations.
- Exports: expressions as `.txt`, Desmos state as JSON, state import, PNG of the graph.
- Color images and photographs are future work. Graph-link generation is not implemented, and state JSON must never be presented as a Desmos link or native file.
- Stack: React, TypeScript, Vite, Tailwind CSS; Python, FastAPI, OpenCV, NumPy, SciPy.

## Brand Commitments

- Name: Image2Desmos.
- No AI or machine learning: every curve comes from deterministic computer vision and mathematics.
- Images are never stored: uploads stay in memory for the request only.
- Independent of Desmos: inspired by it, but never presented as made or endorsed by Desmos.

## Evidence on Hand

Real output from the pipeline on the user's own images. There are no testimonials, customers or benchmarks; none may be invented.

## Product Principles

- The graph is the point: everything else exists to produce or explain it.
- Show the mathematics: equations stay legible, inspectable and tied to the curve they draw.
- Every stage is visible: users can see what each step did to their image.
- Faithful first: favour accuracy, and let the user trade it away.
- Say what is true: claims about privacy, AI and Desmos stay exact.
