# Design Review: Bexino
Date: 2026-10-30
URL: http://127.0.0.1:4173/

## Findings and fixes
- Medium: bg-s-white was both a surface color and a gradient. Large cards and navigation inherited an overly visible dark gradient. Removed the background-image collision; surfaces now use the preset card color.
- Medium: segmented controls reused generic grey values. Added semantic preset aliases from smartisan.css Tab Bar and the skill SPalette.dark; selected segments use the kit inset shadow and border.
- Medium: navigation and cards shared the same dark surface. Navigation now uses the skill appBar token; buttons use the skill control gradient.

## Scope and limits
The kit defines a light design; SPalette.dark is the skill extension, not an official Smartisan dark theme. Existing layout, typography and unrelated work are preserved. README badges and remote statistics are embedded images with their own design; preset classes cannot restyle their internal SVG/image content.

## Verification
Build and 12 existing tests passed. Captured home, repository list and settings in light/dark at 375, 768 and 1280px, plus a dark repository detail. No horizontal overflow or page errors in these checks. Evidence: screenshots under C:/Users/Honor/.codex/visualizations/2026/10/30/01a18bae-9b1a-7460-86a5-b504eb45f8d3/ (before-*, after-*).
