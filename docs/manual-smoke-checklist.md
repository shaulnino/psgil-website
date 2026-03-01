# Manual Smoke Checklist

Use this checklist after each low-risk refactor phase to reduce regression risk.

## Preconditions

- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Use a fresh browser tab to avoid stale UI state

## Click-Through Checklist

### 1) Home (`/`)

- Page loads without errors.
- Header navigation renders and links work.
- Main home widgets/cards render (including race widgets and recent/next race areas).

### 2) Drivers (`/drivers`)

- Drivers page loads with cards/list visible.
- Search/filter interactions still work.
- Clicking a driver opens the driver modal.

### 3) Driver Modal (from Drivers / tables links)

- Modal opens and closes (close button, backdrop, Escape if supported).
- Driver details and stats render.
- "Full Driver Stats" link/button still navigates to stats page.

### 4) Schedule (`/schedule`)

- Schedule page renders grouped race/event content.
- Season switching/filtering still works.
- Any race detail popup/modal still opens where applicable.

### 5) Tables (`/tables`)

- Drivers/constructors standings tables render.
- Driver links in tables still open driver modal.
- Row highlighting for top positions (P1/P2/P3) still appears.

### 6) Stats (`/stats`)

- Tabs switch correctly (Drivers, Teams, Circuits, Head-to-Head).
- Driver select/compare controls still work.
- Charts/tables render without runtime errors.
- H2H filters and race row modal interactions still work.

## Build Gate (required after each phase)

Run:

```bash
npm run build
```

Pass criteria:

- Build completes successfully.
- No TypeScript errors.
- No new lint/type failures introduced by the phase.
