# Photomaker AI

AI-powered web app to generate print-ready passport photo sheets from portrait uploads.

The app removes background in-browser, applies passport styling, supports country-specific photo standards, and exports a 4x6 sheet ready for print and cutting.

## What Is Implemented

- Portrait upload with live preview.
- Multi-photo upload support.
- Auth gate for uploads with more than 2 photos.
- AI background removal (client-side).
- Country-specific passport presets:
  - India (35x45 mm)
  - United States (51x51 mm)
  - United Kingdom (35x45 mm)
  - Schengen / EU (35x45 mm)
  - Canada (50x70 mm)
- Passport enhancement controls:
  - Zoom
  - Vertical offset
  - Brightness
  - Contrast
  - Saturation
- Output styling controls:
  - Passport background color
  - Border color
  - Border thickness
- Automatic 4x6 layout calculation based on selected country dimensions.
- Dynamic copy count on sheet (rows x columns auto-calculated).
- Login and Sign Up modal with local browser persistence.
- Email validation that rejects dummy/temporary patterns.
- Password strength checker (Weak/Medium/Strong).
- Generation credit system (maximum 5 generations).
- Toast notification system for auth and credit events.
- Download final high-resolution PNG for printing.
- Embedded copyright text on generated output.
- In-app legal warning and proprietary licensing docs.

## Workflow

1. Select country specification.
2. Upload portrait image(s).
3. If more than 2 photos are selected, login/signup is required.
4. Generate passport sheet.
5. Fine-tune visual settings (image, border, background).
6. Download the final 4x6 PNG and print.

## Output Specifications

- Sheet size: 6x4 inch landscape at 300 DPI.
- Sheet resolution: 1800x1200 px.
- Passport photo size: Calculated from selected country standard (mm to px at 300 DPI).
- Layout: Auto-fit grid with balanced spacing and cut borders.

## Authentication and Credits

- User accounts are stored in browser localStorage.
- Session state is preserved in browser localStorage for revisit login continuity.
- Uploading more than 2 photos requires login/signup.
- Each generation consumes 1 credit.
- Maximum allowed generations: 5.
- After credits are exhausted, generation is blocked and a toast is shown.

## Tech Stack

- Frontend: React 19
- Build Tool: Vite 8
- Language: JavaScript (ES Modules)
- Styling: Custom CSS (responsive, modern UI)
- AI Background Removal: @imgly/background-removal
- Browser Storage: localStorage (auth/session/credits)
- Linting: ESLint 9
- Runtime: Node.js + npm

## Project Scripts

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Lint code
npm run lint

# Build production bundle
npm run build

# Preview production build
npm run preview
```

## Performance Note

The first AI background removal run can take longer because model assets load in the browser.

## Important Security Note

Current authentication is intentionally browser-local for product flow and revisit convenience.
For production-grade security, migrate authentication to a backend service and never store raw passwords in localStorage.

## Legal and Licensing

Copyright (c) 2026 Furqan Naikwadi. All rights reserved.

This project is proprietary software. Unauthorized copying, redistribution,
reverse engineering, modification, relicensing, resale, or derivative reuse is prohibited
without prior written permission from Furqan Naikwadi.

See full legal terms in:

- [LICENSE](LICENSE)
- [COPYRIGHT_NOTICE.md](COPYRIGHT_NOTICE.md)
