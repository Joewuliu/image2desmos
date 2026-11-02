---
name: Image2Desmos
description: A mathematical workspace where a drawing becomes real equations and the graph owns the screen.
colors:
  surface: "#ffffff"
  gutter: "#eff3f4"
  line: "#d4dcde"
  line-strong: "#b4c0c3"
  graph-rule-major: "#dfe5e7"
  graph-rule-minor: "#f0f3f4"
  ink: "#16232a"
  ink-muted: "#4d5c63"
  ink-disabled: "#7b888e"
  shell: "#103a45"
  shell-line: "#2a5561"
  shell-muted: "#b9ced3"
  accent: "#0b6478"
  accent-hover: "#084f5f"
  accent-soft: "#e0eff2"
  selected: "#c9e4ea"
  danger: "#a8322e"
  danger-soft: "#fbeeed"
  success: "#23693a"
  stroke-1: "#c74440"
  stroke-2: "#2d70b3"
  stroke-3: "#388c46"
  stroke-4: "#6042a6"
  stroke-5: "#fa7e19"
  stroke-6: "#000000"
typography:
  title:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: "1.75rem"
  wordmark:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.5
  panel-title:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  ui:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  button:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.5
  caption:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
  micro:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: "1rem"
  data:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
    fontFeature: "tnum"
  math:
    fontFamily: "KaTeX_Main, Times New Roman, serif"
    fontSize: "0.875rem"
    fontWeight: 400
  code:
    fontFamily: "ui-monospace, Cascadia Code, SF Mono, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
rounded:
  none: "0px"
  thumb: "2px"
  control: "4px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  2xl: "24px"
components:
  button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "32px"
  button-phone:
    height: "44px"
  button-hover:
    textColor: "{colors.accent-hover}"
  button-active:
    backgroundColor: "{colors.accent-soft}"
  button-disabled:
    textColor: "{colors.ink-disabled}"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.surface}"
  button-primary-active:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.surface}"
  button-primary-disabled:
    backgroundColor: "{colors.gutter}"
    textColor: "{colors.ink-disabled}"
  button-link:
    textColor: "{colors.accent}"
    typography: "{typography.button}"
    padding: "0 4px"
    height: "28px"
  button-shell:
    textColor: "{colors.surface}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "32px"
  button-shell-expanded:
    backgroundColor: "{colors.shell-line}"
    textColor: "{colors.surface}"
  app-header:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.surface}"
    height: "44px"
  app-header-phone:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.surface}"
    height: "56px"
  panel-head:
    backgroundColor: "{colors.gutter}"
    textColor: "{colors.ink}"
    typography: "{typography.panel-title}"
    padding: "0 12px"
    height: "36px"
  sidebar-left:
    backgroundColor: "{colors.surface}"
    width: "268px"
  sidebar-right:
    backgroundColor: "{colors.surface}"
    width: "384px"
  pipeline-strip:
    backgroundColor: "{colors.gutter}"
    height: "53px"
  pipeline-stage-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
  equation-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.math}"
  equation-row-selected:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.ink}"
  drop-target:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "28px 24px"
    width: "448px"
  sidebar-sheet:
    backgroundColor: "{colors.surface}"
    height: "56%"
    width: "100%"
  export-bar:
    backgroundColor: "{colors.gutter}"
    textColor: "{colors.ink}"
    typography: "{typography.panel-title}"
    padding: "0 12px"
    height: "44px"
  banner-danger:
    backgroundColor: "{colors.danger-soft}"
    textColor: "{colors.danger}"
    typography: "{typography.ui}"
    padding: "4px 12px"
  banner-status:
    backgroundColor: "{colors.gutter}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.ui}"
    padding: "6px 12px"
  state-notice:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    padding: "8px 12px"
  canvas-notice:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "20px 24px"
    width: "448px"
  undo-notice:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.ui}"
    rounded: "{rounded.none}"
    padding: "4px 12px"
---

# Design System: Image2Desmos

## Overview

**Creative North Star: "The Annotated Graph"**

The whole product is one sheet of graph paper with its working shown beside it. The graph takes the centre and whatever room is left, the controls and equations stand in fixed columns at its edges, and each stage or equation is one click from the curve it explains. The screen is dense because the people using it tune, compare and read repeatedly; nothing is staged for a first impression.

The material is white paper, cool tinted gutters and hairline rules, under a petrol header that gives the app an identity of its own, apart from the calculator it draws in. Colour is rationed by meaning. Petrol belongs to the interface, six classic graphing colours belong to the data, and red and green are spoken only by state. Equations are typeset mathematics, because the result is mathematics.

The light theme is pinned. The direction refuses two things by name: the rounded-card dashboard and the marketing-hero tool page.

**Key Characteristics:**
- Graph-first composition with fixed side columns, sheets under the canvas on phones, and a pipeline strip below the graph.
- Flat and tonal: hairlines and gutters do the structural work.
- Controls with small 4px corners on square panels and frames.
- Typeset equations beside a compact system interface face and tabular readouts.
- Selection that works in both directions between an equation and its curve.

## Colors

A cool, near-neutral paper palette with a single petrol identity, and a separate six-colour data palette that stays out of the interface.

### Primary
- **Petrol Accent** (#0b6478): Primary buttons, link actions, slider fill and thumb, focus outlines, the selected stage rule, and the outlines in the Contours stage, which have not yet become curves.
- **Deep Petrol Accent** (#084f5f): Hover for primary buttons and for the text of default buttons.
- **Petrol Wash** (#e0eff2): Active fill on default buttons, text selection, and the track of the busy bar.
- **Selected Tint** (#c9e4ea): The selected equation row, full width.

### Secondary
- **Petrol Shell** (#103a45): The header, and the pressed state of primary buttons.
- **Shell Rule** (#2a5561): Borders of header buttons, and their pressed or expanded fill.
- **Shell Mist** (#b9ced3): Secondary text on the header, and the anchor points of the curve mark.

### Tertiary
The stroke palette follows the classic graphing colours, one per contour, repeating in order. Dimmed curves behind a selection in the live graph are these colours mixed 80% toward white as solid values, because translucent segments darken where they overlap.
- **Graph Red** (#c74440): Stroke 1.
- **Graph Blue** (#2d70b3): Stroke 2.
- **Graph Green** (#388c46): Stroke 3.
- **Graph Purple** (#6042a6): Stroke 4.
- **Graph Orange** (#fa7e19): Stroke 5. The lightest of the six on white, so its identity is never carried by the colour alone; contour dots add a thin ink ring and every row carries a number.
- **Graph Black** (#000000): Stroke 6.

### Neutral
- **Graph White** (#ffffff): The graph, panels, and text on petrol.
- **Cool Gutter** (#eff3f4): Panel heads, the pipeline strip, the footing hint bar, trace warning lines, and the index column of equation rows.
- **Hairline** (#d4dcde): The default border between every region and row, the frame of canvas notices, and the empty part of a slider track.
- **Firm Hairline** (#b4c0c3): Default button borders, the drop target and undo notice borders, flow chevrons, the graph axis in thumbnails, the thumb of a locked slider, and scrollbar thumbs.
- **Major Graph Rule** (#dfe5e7) and **Minor Graph Rule** (#f0f3f4): The 120px and 24px lines of the empty graph ground.
- **Petrol Ink** (#16232a): Primary text.
- **Muted Ink** (#4d5c63): Secondary text, hints, and captions.
- **Disabled Ink** (#7b888e): Labels of disabled buttons only; it is not a text colour for readable content.

### State
- **Danger** (#a8322e) on **Danger Wash** (#fbeeed): Failures, a failed copy, and skipped-segment notices.
- **Success** (#23693a): Text-only confirmation of a completed copy, export, or import.

### Named Rules
**The Data-Only Stroke Rule.** The six stroke colours appear only where they identify a contour: curves, the graph, stage thumbnails, and contour dots. They never mark state, chrome, or brand.

**The Petrol Voice Rule.** Everything the interface says for itself is petrol. Fitted curves never wear it, and no second interface hue exists.

## Typography

**Interface Font:** the system sans stack (system-ui, with Segoe UI, Roboto, Helvetica Neue, and Arial behind it)
**Math Font:** KaTeX's Latin Modern set (KaTeX_Main, with Times New Roman behind it)
**Label/Mono Font:** the system mono stack (ui-monospace, with Cascadia Code, SF Mono, and Consolas behind it), for the file path and variable in the no-key setup note only

**Character:** The interface stays small and quiet so the serif mathematics reads as the content. The contrast between the two faces is the identity; there is no display role in this system, because the workspace has no headline moment.

### Hierarchy
- **Title** (600, 18px, 28px): The drop target's prompt, the largest text in the system.
- **Wordmark** (600, 15px, 1.5): The product name in the header.
- **Panel Title** (600, 13px, 1.5): Panel heads such as Tracing, Curve fitting, and Export, and the Export bar on phones.
- **Body** (400, 14px, 20px): Canvas notices and empty-state explanation.
- **UI** (400, 13px, 20px): Slider labels, the banner lines above the canvas, the undo notice, empty column messages, and header metadata. Stage names use its size with a 16px line from 36rem of strip width, and Caption size below that.
- **Button** (500, 13px, 1.5): Every button.
- **Caption** (400, 12px, 16px): Status lines, contour group labels, export notes, the paste note, saved-state and import notices, and the footing hint.
- **Micro** (400, 11px, 16px): Slider end labels, stat labels, stage details, and the equation index column. Always secondary to a larger value beside it.
- **Data** (500, 14px, 20px, tabular): Result statistics.
- **Math** (400, 14px in equation rows, 15px for symbolic slider values, 12px in the stats range line): KaTeX at 1em of its container, without wrapping.

### Named Rules
**The Real Math Rule.** Equations and mathematical symbols are typeset by KaTeX, never approximated in the interface face.

**The Tabular Readout Rule.** Counts, measurements, and slider values use tabular numerals, so a readout holds still while a control moves.

## Layout

One full-height screen with no page scroll. The header spans the top at 44px (56px on phones). Below it, the left column is 268px and the right column is 384px. The centre takes everything else: banners when needed, the canvas, then the 53px pipeline strip. Lists scroll inside their own columns, and the sticky contour label stays visible while they do.

The canvas shows either the live graph edge to edge or, for other stages, the image framed at its true aspect ratio on the graph ground with 16px of breathing room.

From 1180px both columns default open and can each be closed. From 640px to 1179px they default closed, push the canvas rather than cover it, and only one is open at a time. The live graph re-fits to its new size whenever a column moves, unless the user has panned or zoomed; Fit to image takes it back. Wide and narrow screens remember their open columns separately, and on narrow screens Escape closes a column before it clears a selection.

Below 640px a column becomes an in-flow sheet under the canvas and pipeline strip, one at a time, at 56% of the height, so the graph stays in view. Every button, link buttons included, and every slider grows to a 44px touch target. Replace and Remove leave the header for a two-column row at the foot of the Controls sheet. In the Equations sheet the list takes the free height and Export stays pinned at the foot as a 44px disclosure bar, in reach at any list length. The header status word is left to screen readers, the stats strip drops its segment mix line, and the privacy line moves to the end of the slider list unless the footing has a hint or note to show.

The pipeline strip responds to its own width through container queries, not the viewport, so an open column on a tablet can take its details or thumbnails away. Below 36rem, which covers phones in portrait, it shows names only. From 36rem it adds details and flow chevrons, and from 48rem it adds thumbnails.

Spacing is tight and small-stepped: 12px at panel edges, 6px to 8px within rows and between controls, and 16px to 28px only inside the notice and drop-target surfaces. There are no gaps between regions; they meet at a hairline.

### Named Rules
**The Graph Remainder Rule.** Side columns have fixed widths, and all spare space goes to the graph.

**The Graph In View Rule.** Opening a panel never covers the graph. A column pushes it, and a sheet sits below it.

**The Shared Foot Rule.** Beside the canvas, the left column's footing hint and the pipeline strip are both 53px tall, so their tops form one line across the workspace.

## Elevation & Depth

The system is flat. Depth comes from tone (white on gutter), hairlines, and sticky regions that simply sit on top of the list scrolling beneath them. The only shadow used as a surface treatment is the 2px inset rule on the selected pipeline stage, which draws a line inside the tab and lifts nothing. Things that sit over the canvas, such as the undo notice and Fit to image, stay flat too and are separated by their border alone.

### Shadow Vocabulary
- **Stage rule** (`box-shadow: inset 0 2px 0 var(--color-accent)`): The selected stage's top rule. It marks selection, not height.

### Named Rules
**The Flat Workbench Rule.** Nothing casts a drop shadow. A region that needs separating gets a hairline or a tone change.

## Shapes

Geometry follows function. Controls carry a small 4px corner, slider thumbs a sharper 2px, and structural things stay fully square: panels, banners, notices, the image frame, stage thumbnails, equation rows, and the drop target. This refines the direction's "square-ish 4px corners", which the build applies to controls alone. Round forms are kept for marks that are points or motion: contour dots, the export spinner, and the anchor points in the mark.

The curve mark is the one emblem: a white S-curve between two Shell Mist anchor points, on petrol. It replaces the direction's Bézier-with-handles mark. The favicon is the same mark on a petrol square with a 4px corner.

### Named Rules
**The Square Frame Rule.** If it holds content, it has square corners; if you press or drag it, it has a small corner.

## Components

### Buttons
Compact and unornamented, with one vocabulary for the whole workspace.
- **Shape:** Small corners (4px), 32px tall, 12px side padding, 1px border; 44px tall on phones.
- **Default:** White with a Firm Hairline border and Petrol Ink text. The export actions and Fit to image use it.
- **Primary:** Solid Petrol Accent with white text. At most one per panel; Copy Expressions holds the role once a result exists, and Render anyway holds it in the heavy-graph notice.
- **Hover / Focus:** Default buttons shift border to Petrol Accent and text to Deep Petrol; primary buttons deepen. Pressed default buttons fill with Petrol Wash, pressed primary buttons with Petrol Shell. Colour transitions take 120ms. Focus is a 2px Petrol Accent outline, offset 1px; white on the header.
- **Link:** Text-only in Petrol Accent, 28px tall, underlined on hover. Used for quiet actions such as Reset all, Show more, Retry, Dismiss, Undo, Cancel, Open a saved state, Close saved state, and Restore generated graph.
- **Shell:** Transparent on the header with a Shell Rule border and white text. Its expanded state fills with Shell Rule.
- **Disabled:** Hairline border and Disabled Ink text, with a not-allowed cursor; primary buttons also fill with Cool Gutter. Copy Expressions and Download expressions disable while a new trace runs, because their expressions are about to be replaced.

### Sliders
Instrument-like rows that repeat through the left column.
- **Row:** Label and live value on one line, a 4px track, then Micro end labels naming what each direction does (Bold only, Faint too). Rows are divided by hairlines.
- **Track and thumb:** Petrol fill to the current value over Hairline, with a square-ish 10 by 16px thumb (2px corners) and a white keyline.
- **Value:** Symbolic parameters show typeset math such as the sigma value in Blur; the rest show tabular numbers.
- **Hint:** Hovering or focusing a row replaces the footing line with its one-sentence explanation. By default that line carries the privacy, no-AI, and independence statement.
- **Locked:** With no image, an imported state, or a saved state, the track turns Hairline, the thumb Firm Hairline, and the cursor not-allowed, and Reset all disables. Imported and saved states put the reason in the footing line.

### Panels
- **Head:** A 36px gutter band with a Panel Title on the left, an action or status on the right, and a hairline beneath.
- **Corner Style:** Square (0px).
- **Background:** Graph White columns.
- **Shadow Strategy:** None; see Elevation & Depth.
- **Border:** 1px Hairline against the canvas.
- **Internal Padding:** 12px at the edges.

### Navigation
The header is a petrol band: Controls toggle, mark and wordmark, file metadata, status, image actions, Equations toggle. The toggles sit at the outer edges above the columns they govern. File metadata, or the saved state's file name, appears from 768px. On phones the band is 56px tall and Replace and Remove move to the Controls sheet.

### Busy Bar
The busy state is a word in the header (Tracing… or Updating…) plus a 2px indeterminate bar along the top of the canvas: Petrol Accent over a Petrol Wash track, in a 1100ms standard ease. Under reduced motion the bar holds still at full width.

### Pipeline Strip
The app's stage selector and its explanation of the process, built as five equal tabs: Source, Edges, Contours, Curves, Graph. Each carries a name and, as the strip's width allows, a real measure from that stage and a live thumbnail. Tabs are divided by hairlines, with a small Firm Hairline chevron at each join once details show. The selected tab turns white with the 2px petrol stage rule; unavailable tabs stay in place in Muted Ink and are disabled. Left and right arrow keys move between the available stages.

### Equation List
Rows pair a gutter index column (48px, holding number, contour dot, and segment type) with equations typeset by KaTeX, grouped by contour. A sticky white label gives each contour's dot, name, and segment count. A parametric row is shown as an x(t) line above a y(t) line, which fits the column and reads better than one long point; circles and other expressions appear as written. This is display only: Copy Expressions and Download expressions always carry the serialized expression, one per line.

The panel head holds the count and Copy Expressions. After a copy the count gives way to "Copied" and the number in Success for 3 seconds, or to a failure line in Danger that points to Download expressions. Beneath the head, a permanent Caption note says to paste into a Desmos expression line and that Desmos assigns its own colours. Selected rows fill with Selected Tint across both columns. Up and down arrows move within the list, which is one Tab stop. The list shows 200 rows at a time with Show more at its foot, and always reaches far enough to show the selected row.

**The Two-Way Selection Rule.** Selection runs both ways on the Graph and Curves stages: choosing an equation emphasises its curve, and picking a curve selects its equation, scrolls to it, and opens the equations panel if it was closed. A press that moves more than 4px is a pan, not a pick. Picking the selected curve again, picking empty paper, or pressing Escape clears the selection, and a selection never outlives its result or reaches an export. In the live graph the selected curve goes from 2.5px to 6px and the others turn to their solid pale tints, never opacity; above 800 expressions the graph skips the dimming, because it would be too slow, and keeps the thickening. The Curves stage thickens from 2px to 6px over the other curves at 25% stroke opacity. Source, Edges, and Contours fall to 30% opacity and show the selected segment at 6px on top.

### Graph Ground
The empty state of the graph is itself a graph: 24px minor rules and 120px major rules on white. It sits behind the drop target, framed stages, loading, errors, and notices, so waiting states stay in the same world.

### Drop Target
A square white block up to 448px wide, centred on the graph ground, with a Firm Hairline border. It holds the Title prompt, an underlined browse link, and in Caption the limits and a line on how strokes are traced. Dragging fills the block with Petrol Wash, turns the border Petrol Accent and changes the prompt to "Release to upload". Below the block sits the Open a saved state link, on a white ground so it reads against the rules, and only where the live graph is available.

### Stats Strip
Four labelled figures in a row at the top of the right column (Micro label over Data value), with one Caption line for the mix of segment types and mean error, and one for the parameter range. Phones keep the figures and the range. An imported or saved state replaces the strip with its notice.

### Export
A two-by-two grid of default buttons at the foot of the right column, below the list: Download expressions, Download PNG, Export state JSON, and Import state JSON. Beneath them one 32px Caption slot holds the standing note, a working line with its spinner, a result in Success or Danger, or a wait with Cancel, so the buttons never move under the pointer; on phones the slot can grow. Success lines clear after 6 seconds. Without a Desmos key the state and image actions disable and the slot says why. On phones the section head becomes a 44px gutter disclosure bar with a chevron that turns over when open. It starts closed and stays pinned beneath the list.

### Banners
Full-width lines between the header and the canvas, with a hairline beneath. A failed trace is a Danger Wash line in Danger text with a Retry link button. A failed replacement says the current image is unchanged and carries Dismiss. Trace warnings are Cool Gutter lines in Muted Ink with no action, and give way to a failure.

### Notices
Messages on the canvas are square white blocks up to 448px wide with a Hairline border, centred on the graph ground, in Body. The no-key notice says the live graph isn't available here, points to desmos.com/calculator, and folds the key setup into a Caption disclosure, "Setting up this copy?". The heavy-graph notice appears above 1,500 expressions and holds Render anyway. Loading and load failures sit directly on the ground, the failure in Danger with a default Try again button.

### Undo Notice
A square white strip with a Firm Hairline border, 12px from the bottom-left corner of the canvas, in UI text with an Undo link button. It follows Remove and Reset all, lasts 10 seconds, and goes early when the user changes a setting or opens another file. On phones it is a full-width bar between the canvas and the pipeline strip, so it never covers the empty screen's actions.

### Imported and Saved States
An import replaces the generated graph, and everything that describes the graph follows it: the list, the count (labelled imported expressions), Copy Expressions, Download expressions, and the Graph stage's count all use the state's own expressions. A Caption notice holds Restore generated graph in place of the stats strip. Rows are read-only, without contour labels, and their dots use the state's colours. Sliders lock, the footing says how to tune again, and the Graph thumbnail keeps its axes but drops its curves. The next trace result also ends the import.

A saved state opened from the empty screen is a Graph-only mode with no image behind it. The calculator shows the state in its own viewport, so Fit to image is absent, and every stage but Graph is disabled. The right column leads with a saved-state notice naming the file and Close saved state, then the same read-only list and Export. Sliders lock and the footing says to upload an image to trace and tune it.

## Do's and Don'ts

### Do:
- **Do** give every spare pixel to the graph and keep side columns at 268px and 384px from 640px up.
- **Do** keep the graph in view when a panel opens: push it with a column, or sit a sheet below it.
- **Do** use the six stroke colours only to identify a contour, in their fixed order.
- **Do** typeset equations and symbols with KaTeX.
- **Do** use tabular numerals for counts, measures, and slider values.
- **Do** separate regions with a 1px hairline or a tone change between white and Cool Gutter.
- **Do** use the 4px corner on controls and square corners on frames, panels, and rows.
- **Do** keep round forms for points and motion: contour dots, the spinner, and the anchor points in the mark.
- **Do** place waiting, empty, and error states on the graph ground.
- **Do** show the same selection on both the equation and its curve.
- **Do** make every list, count, and export describe what the graph is showing, including an imported state.
- **Do** give phones 44px targets and keep Export in reach of any list length.
- **Do** honour reduced motion, and keep transitions to colour at around 120ms.
- **Do** offer Undo for Remove and Reset all, and a way out of every failure.
- **Do** write interface labels in natural case.

### Don't:
- **Don't** build rounded-card dashboards or a marketing hero; the workspace itself is the first screen.
- **Don't** use a stroke colour for state, chrome, or brand, including Graph Red for errors.
- **Don't** draw fitted curves in petrol; petrol on the canvas is for contours before fitting.
- **Don't** add drop shadows to raise a panel, button, or notice.
- **Don't** set equations in the interface face or as images of text.
- **Don't** let a display form change what is copied; x(t) and y(t) lines are for reading, and the serialized expression is what leaves the app.
- **Don't** use Disabled Ink for readable content.
- **Don't** introduce a second interface hue.
- **Don't** make the app look made or endorsed by Desmos; the petrol shell and the curve mark keep it apart.
