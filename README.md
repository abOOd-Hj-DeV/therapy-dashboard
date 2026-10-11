# Sakina — Therapy Dashboard

Responsive React + TypeScript implementation of the **first** Sakina Figma file. Vite serves the app; fonts, illustrations, patient photos, and icons are local assets.

## Run

Requires Node.js **22.12+** (Node 22 recommended) and npm.

```sh
git clone --branch devin/1791699736-figma-react-dashboard https://github.com/abOOd-Hj-DeV/therapy-dashboard.git
cd therapy-dashboard
npm ci
npm run dev
```

Open the address Vite prints. On WSL2, run the same commands from your project directory (for example `/mnt/c/Users/1/Desktop`) and open the printed address in your Windows browser. You can also run this in PowerShell with Node installed.

```sh
npm run build       # production files in dist/
npm run preview     # preview the production build
```

Configure production hosting to rewrite unknown paths to `index.html` so direct links to `/signup`, `/verify`, and `/dashboard` work.

## Screens and design previews

| URL                              | State                                                           |
| -------------------------------- | --------------------------------------------------------------- |
| `/` or `/login`                  | Sign in; disabled, filled, password visibility, loading         |
| `/signup`                        | Create account; desktop names side by side, phone names stacked |
| `/verify`                        | Five-digit verification; keyboard and paste support             |
| `/dashboard`                     | Therapist dashboard; four metrics and seven upcoming sessions   |
| `/dashboard?state=collapsed`     | Collapsed desktop sidebar                                       |
| `/dashboard?state=expanded`      | Expanded phone navigation                                       |
| `/dashboard?state=search`        | Open search with the design's `Fa` results                      |
| `/dashboard?state=notifications` | Notifications and invitation actions                            |
| `/dashboard?state=offline`       | Offline preview; real online/offline browser events also work   |
| `/dashboard?state=meeting`       | Meeting dialog and copy-link action                             |

All screens respond to desktop, tablet, and phone widths. The tablet dashboard uses an icon rail; phones use a navigation drawer. Dialogs support Escape, keyboard focus containment, and focus restoration. Motion respects `prefers-reduced-motion`.

### Demo-only functionality

**This is not a production authentication system.** Valid-looking login/signup inputs simulate navigation; any complete five-digit code opens the demo dashboard. No account is created, password stored, email sent, or OTP checked by a server. Google, password reset, meeting joining, notifications, patients, and statistics are not connected to APIs. Notification accept/deny updates local state only. Clipboard copying uses the browser's Clipboard API where permitted.

Patients, Sessions, Messages, Additional Content, Wallet, profile settings, and Client Review currently show clearly marked placeholders: their destination designs were not provided in the first file. **The second Figma file is still pending**, and these placeholders must be replaced when its designs are supplied.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm audit
npx playwright install chromium
npm run test:visual
```

- **16 component tests:** validation, loading, password visibility, signup, OTP paste, resend, honest demo messaging, sidebar, search, notifications, meeting, and real connection events.
- **29 browser tests:** 26 visual baselines across responsive authentication/dashboard states, keyboard modal behavior, phone interactions, and 320px overflow checks. Dashboard images are also checked for failed asset loads and browser errors.
- Baselines were generated on **Linux using the pinned Playwright Chromium**. Other operating systems may render fonts differently. Use Linux for consistent baseline comparisons.
- `npm run test:visual:update` intentionally replaces the application baselines; review changes before committing them.

### Visual fidelity — what the tests prove

The screenshot tests compare the implementation with **its own reviewed baselines**, not with Figma pixels. Passing them detects future visual regressions; it does **not** prove 100% Figma parity. Figma's cached dashboard exports are downscaled, so a pixel-perfect claim would be misleading.

| Screen/state          | Figma evidence used                          | Browser coverage                                    |
| --------------------- | -------------------------------------------- | --------------------------------------------------- |
| Desktop/phone sign in | Exported references and design context       | Desktop/tablet/phone snapshots                      |
| Create account        | Desktop context and phone export             | Desktop/tablet/phone snapshots                      |
| Verification          | Desktop context; responsive frame inventory  | Desktop/tablet/phone snapshots; OTP component tests |
| Default dashboard     | Desktop/tablet/phone exports and context     | All three sizes                                     |
| Collapsed navigation  | Desktop export/context                       | Desktop snapshot                                    |
| Expanded navigation   | Phone frame inventory                        | Phone snapshot and drawer interaction               |
| Search                | Desktop export/context; responsive inventory | All three sizes and search interaction              |
| Notifications         | Desktop export/context; responsive inventory | All three sizes and invitation interaction          |
| Offline               | Desktop export/context; responsive inventory | All three sizes and browser connection events       |
| Meeting               | Desktop export/context; responsive inventory | All three sizes and modal keyboard behavior         |

Tablet/phone overlay variants and OTP were implemented from shared design context/inventory; each was tested in the app, but not individually compared to a dedicated Figma export. Minor background texture, font, icon, spacing, and scaling differences may remain. No new Figma requests were made after the first file's **20-attempt** budget.

## Structure

- `src/Auth.tsx`: sign-in, signup, verification.
- `src/Dashboard.tsx`: responsive workspace and overlays.
- `src/ui.tsx`: shared logo, icons, native dialog.
- `src/data.ts`: typed frontend fixtures.
- `src/styles.css`: design tokens and responsive CSS.
- `tests/app.test.tsx`: component behavior tests.
- `tests/visual/`: Playwright tests and visual baselines.

Routing is deliberately lightweight (`history.pushState`/`popstate`); no routing or UI framework is required beyond React. Development server is served to the network for local/device previews — don't expose it publicly. Build and serve `dist/` for production.
