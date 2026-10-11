# Sakina — Therapy Dashboard

Responsive React + TypeScript implementation of the **two supplied** Sakina Figma files. Vite serves the app; fonts, illustrations, patient photos, and icons are local assets.

## Run

Requires Node.js **22.12+** (Node 22 recommended) and npm.

```sh
git clone --branch devin/1791701771-figma-chats-sessions https://github.com/abOOd-Hj-DeV/therapy-dashboard.git
cd therapy-dashboard
npm ci
npm run dev
```

Open the address Vite prints. On WSL2, run the same commands from your project directory (for example `/mnt/c/Users/1/Desktop`) and open the printed address in your Windows browser. You can also run this in PowerShell with Node installed.

```sh
npm run build       # production files in dist/
npm run preview     # preview the production build
```

Configure production hosting to rewrite unknown paths to `index.html` so direct links to all the routes below work.

## Screens and design previews

| URL                                | State                                                           |
| ---------------------------------- | --------------------------------------------------------------- |
| `/` or `/login`                    | Sign in; disabled, filled, password visibility, loading         |
| `/signup`                          | Create account; desktop names side by side, phone names stacked |
| `/verify`                          | Five-digit verification; keyboard and paste support             |
| `/dashboard`                       | Therapist dashboard; four metrics and seven upcoming sessions   |
| `/dashboard?state=collapsed`       | Collapsed desktop sidebar                                       |
| `/dashboard?state=expanded`        | Expanded phone navigation                                       |
| `/dashboard?state=search`          | Open search with the design's `Fa` results                      |
| `/dashboard?state=notifications`   | Notifications and invitation actions                            |
| `/dashboard?state=offline`         | Offline preview; real online/offline browser events also work   |
| `/dashboard?state=meeting`         | Meeting dialog and copy-link action                             |
| `/chats`                           | Desktop/tablet conversation; phone conversation list            |
| `/chats?state=empty`               | Arabic empty conversation state                                 |
| `/chats?state=list`                | Conversation list                                               |
| `/chats?state=thread`              | Sara's conversation, including the phone thread                 |
| `/chats?state=offline`             | Offline warning and disabled outgoing messages                  |
| `/chats?state=collapsed`           | Collapsed desktop chat navigation                               |
| `/sessions`                        | All, Previous, Upcoming, Today filters and 16 demo fixtures     |
| `/sessions?state=schedule`         | Schedule a new session                                          |
| `/sessions/upcoming`               | Client overview, preparation, clinical summary and pathway      |
| `/sessions/upcoming?state=actions` | Reschedule/delete menu                                          |
| `/sessions/upcoming?state=record`  | Notes, exercises, outcome, continuity note and follow-up flags  |
| `/sessions/upcoming?state=create`  | Create homework dialog                                          |
| `/sessions/upcoming?state=library` | Homework library, search and content filters                    |
| `/sessions?state=expanded`         | Expanded phone navigation drawer                                |

All screens respond to desktop, tablet, and phone widths. The tablet dashboard uses an icon rail; phones use a navigation drawer. Dialogs support Escape, keyboard focus containment, and focus restoration. Motion respects `prefers-reduced-motion`.

### Demo-only functionality

**This is not a production authentication system.** Valid-looking login/signup inputs simulate navigation; any complete five-digit code opens the demo dashboard. No account is created, password stored, email sent, or OTP checked by a server. Google, password reset, meeting joining, notifications, patients, and statistics are not connected to APIs. Notification accept/deny updates local state only. Clipboard copying uses the browser's Clipboard API where permitted.

Sessions, Messages, and Client Review now open the second file's implemented screens. Messages, attachments, scheduling, rescheduling, notes, homework and outcomes operate in component memory only; refreshing or leaving the page resets them. No message, file, calendar change, clinical record, supervisor alert or client notification is sent to a server. Delete requires confirmation and only exits the demo detail view. Full patient profiles, Additional Content, Wallet and profile settings still show clearly marked placeholders because neither supplied file includes their destination screens.

The Figma fixtures inconsistently use Mark lory in the session header and Ahmed in the homework/response area. The default preview retains those labels; opening a patient from the session list uses the selected patient's name. The source's preparation view highlights “Session record”; this implementation highlights the tab whose content is actually displayed. SF Pro is not bundled; the locally hosted IBM Plex Sans/Inter fonts provide the fallback. Additional session fixtures complete the source's 16/6/8/2 filter totals.

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

- **32 component tests:** the original 16 authentication/dashboard tests plus chat selection, filtering, unread badges, local replies/attachments, offline events, navigation, session counts/scheduling, patient routes, notes, continuity, homework creation/library, rescheduling and demo deletion.
- **67 browser tests:** the original 29 tests plus 38 second-file tests. There are 35 additional visual baselines, including desktop/tablet/phone chats, sessions, details and dialogs. Browser checks cover missing assets, page errors, 320px overflow, mobile navigation, scheduling, offline messaging and modal focus containment/restoration.
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

### Second-file evidence and limits

Source: [Figma file 2](https://www.figma.com/design/dbEbuybwc2dUDJ9QCwNjWL/Untitled). The new `figma-remote` connection was verified, and its 20-attempt budget was exhausted before implementation. Contexts, exports and assets were cached locally; no additional design requests were made. Figma screenshots are references only, never application assets.

| Screen/state                   | Dedicated cached Figma export                              | Browser coverage                                                                 |
| ------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Chats                          | Desktop `2:308`, tablet `2:1056`                           | Both sizes, plus phone list/thread                                               |
| Empty chat                     | Desktop `2:727`                                            | All three widths                                                                 |
| Phone chat list/thread         | `2:1667`, `2:1484`                                         | Dedicated phone snapshots and replies/back navigation                            |
| Offline chats                  | Variant inventory, shared chat contexts                    | All three widths and real browser events; no dedicated offline export comparison |
| Sessions/scheduling            | Desktop `2:2089`, tablet `2:2644`, phone `2:3329`          | All three widths, form submission and patient navigation                         |
| Preparation/actions            | Desktop `2:3712`, tablet `2:3942`, phone `2:5860`          | All three widths; clinical summary and overflow menu                             |
| Session record                 | Phone `2:5047`; desktop visible beneath dialogs            | All three widths and note/outcome interactions                                   |
| Create homework                | Desktop `2:6338`, phone `2:5230`                           | All three widths and creation/removal                                            |
| Homework library               | Desktop `2:6618`, phone `2:5445`                           | All three widths, filtering and duplicate prevention                             |
| Tablet record/homework dialogs | Shared desktop/phone contexts, tablet preparation geometry | Tested in the app; no dedicated tablet record/dialog export                      |

Direct export comparisons guide geometry and refinement; downscaled Figma exports, native form controls, focus indicators and the documented source inconsistencies prevent an honest claim of **100% pixel parity**. The app-owned baselines remain regression tests, not a Figma parity score.

## Structure

- `src/Auth.tsx`: sign-in, signup, verification.
- `src/Dashboard.tsx`: responsive workspace and overlays.
- `src/Workspace.tsx`: shared second-file navigation, topbar, drawer and mobile navigation.
- `src/Chats.tsx`: conversation list, threads, composer and offline behavior.
- `src/Sessions.tsx`: session fixtures, filters and scheduling dialog.
- `src/SessionDetails.tsx`: preparation, records and homework dialog.
- `src/ui.tsx`: shared logo, icons, native dialog.
- `src/data.ts`: typed frontend fixtures.
- `src/styles.css`: design tokens and responsive CSS.
- `src/secondary.css`: scoped second-file responsive layouts.
- `tests/app.test.tsx`: component behavior tests.
- `tests/secondary.test.tsx`: chat/session component behavior tests.
- `tests/visual/`: Playwright tests and visual baselines.

Routing is deliberately lightweight (`history.pushState`/`popstate`); no routing or UI framework is required beyond React. Development server is served to the network for local/device previews — don't expose it publicly. Build and serve `dist/` for production.
