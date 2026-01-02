# Instructions to Replace Favicon with DOER Logo

The SVG icon has been created at `src/app/icon.svg`, but Next.js prioritizes ICO and PNG files over SVG.

## Quick Solution (Recommended)

1. Visit https://realfavicongenerator.net/ or https://favicon.io/favicon-converter/
2. Upload the `src/app/icon.svg` file
3. Download the generated favicon.ico and icon.png files
4. Replace the existing files:
   - `src/app/favicon.ico`
   - `src/app/icon.png`
   - `public/favicon.ico` (if exists)
   - `public/icon.png` (if exists)

## Alternative: Delete Old Files

If you want to use SVG only (works in modern browsers):
1. Delete `src/app/favicon.ico`
2. Delete `src/app/icon.png`
3. Delete `public/favicon.ico` (if exists)
4. Delete `public/icon.png` (if exists)

The SVG will then be used automatically.

## Current SVG File

The SVG file at `src/app/icon.svg` contains:
- Black background (#000000)
- White "DOER" text in bold Arial
- 32x32 viewBox

