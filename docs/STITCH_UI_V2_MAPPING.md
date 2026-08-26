# Bloom Stitch UI v2 mapping

Project: `3157593995190212714` — Bloom Today Screen Redesign  
Inventory date: 2026-08-26  
Status: Gate 0 source-of-truth mapping, before application UI edits

## Selection rules

- Local `DESIGN.md` remains the design-token and product-style source of truth.
- The selected Stitch screenshots below are the composition and hierarchy source of truth for their matching app states.
- Visible `Refined`, `Redesigned`, `Premium`, or immersive generations win over older hidden drafts.
- A hidden screen is selected only when it is the project's sole reference for a unique functional state. It must be normalized to the selected current design system during implementation.
- Raw desktop screenshots uploaded to Stitch are recon/reference material, not mobile implementation sources.
- No finalized Timeline Year generation exists in this project. The real Year view will retain its behavior and be normalized to the approved Timeline Month and `DESIGN.md` system; no Stitch design will be invented or claimed for it.

## Selected implementation sources

| Feature | Real app state | Selected Stitch source | Theme | Decision |
| --- | --- | --- | --- | --- |
| Today | Today home | `35948ade61644a78bc3d92edb7ca7d71` — Bloom Today - Light (Refined v2) | Light | Final |
| Today | Today home | `8499bb73e31a4faf868023030ddbfe37` — Bloom Today - Dark (Refined v2) | Dark | Final |
| Timeline | Month | `cce8dcffccc34de384f670175c0461aa` — Timeline Month - Light (Refined) | Light | Final |
| Timeline | Month | `f6d0790188d0495383e9ecc9294f2e24` — Timeline Month - Dark (Refined) | Dark | Final |
| Timeline | Year | No matching Stitch generation | Both | Preserve real behavior; normalize to Month patterns and `DESIGN.md` |
| Log Period | Ongoing | `71362e96714043dbb298c494b8c73c27` — Log Period - Light (Ongoing) | Light | Sole unique-state reference; hidden but selected |
| Log Period | Ongoing | `c8a67508e174435c8d2f83d9e44c8bcf` — Log Period - Dark (Ongoing) | Dark | Final |
| Log Period | Ended | `e1254e3ab85d430cafdf9ee6049db8cc` — Log Period - Light (Ended) | Light | Sole explicitly light ended-state source; hidden but selected |
| Log Period | Ended | `784a49fa6e7944878daf2b59f2a2a5f2` — Log Period - Dark (Ended) | Dark intent; screenshot currently renders light | Selected shown ended-state generation; apply the approved dark tokens because title/render metadata conflicts |
| Meg | Home / starter prompts | `3c22e385f780403296fb82979ec7b1c0` — Meg - Premium Light | Light | Final |
| Meg | Home / starter prompts | `babe7b46fd7848929d5be942238ca30f` — Meg - Premium Dark (Refined) | Dark | Final |
| Strength | Home / exercise selection | `7793b52aa4da4e68a444a37ee3b9b184` — Strength Home - Refined Light | Light | Final |
| Strength | Home / exercise selection | `6469038d202f487f8aef6981cdcbc2d1` — Strength Home - Refined Dark | Dark | Final |
| Strength | Ready / positioning | `762feba1120b4ef3a809e21200986673` — Ready to Start - Refined Light | Light | Final |
| Strength | Camera-guided active session | `9a0d6937d6f84f74b829509974b8ad47` — Strength Session - Refined Dark (Immersive) | Dark | Final |
| Strength | Session summary | `c04086ce5bfc4c438d8e6fad316bc171` — Session Summary - Refined Light | Light | Final |
| Strength | Camera-free active session | `7486f5650822476bb3173d8ef0ea5421` — Camera-Free Mode - Light | Light | Sole unique-state reference; hidden but selected and normalized |
| Strength | Camera unavailable/error | `95a56f496cb340d8a0c3d63ad9a7c496` — Camera Error - Dark | Dark | Sole unique-state reference; hidden but selected and normalized |
| Diet | Home | `dc01a4ce1d9d4efbb4d2df91add235b1` — Diet Home - Light (Redesigned) | Light | Final |
| Diet | Home | `1ad5ff314be64d6aaa738e752ea3044d` — Diet Home - Dark (Redesigned) | Dark | Final |
| Diet | Meal log | `33402d6dff8d4d23b14e7165b98c0d1f` — Meal Log - Light | Light | Final |
| Diet | Craving Rescue | `02ae327311a14c37b6b2d1857965c07d` — Craving Rescue - Light | Light | Final |
| Diet | Rescue Kit | `88c49a5e85ca453ab912f33234b762ab` — Rescue Kit - Light | Light | Final |

Secondary states without a dedicated selected light/dark counterpart use the selected state layout, shared app theme tokens, and the closest approved feature shell. Functional content continues to come from the real app.

## Superseded hidden UI generations

These are intentionally ignored as direct implementation sources because a selected newer/refined generation exists.

### Today

| Stitch source | Title | Reason ignored |
| --- | --- | --- |
| `46a90b901b2549bca0bc66149558daa9` | Bloom Today - Light Theme | Earliest unrefined light draft |
| `ccaa6d8924cf42149c49a1724adef495` | Bloom Today - Dark Theme | Earliest unrefined dark draft |
| `fce9fa8c5a8f4c92a23b026e1dd01106` | Bloom Today - Dark Theme Refined | Superseded by Refined v2 |
| `0b086fd8e9374465a1741d3158315e37` | Bloom Today - Light (Refined) | Superseded by Refined v2 |
| `a91b5108f3634892892237130b1022f1` | Bloom Today - Dark (Refined) | Superseded by Refined v2 |
| `2a5c73d3fbc24b02bc1f6e47023c32fe` | Bloom Today - Light (Final Nav) | Superseded by the current Refined v2 source |
| `a69b98659f29408e992b6b023217dc88` | Bloom Today - Dark (Refined v2) | Hidden duplicate generation; current visible Refined v2 selected |

### Timeline

| Stitch source | Title | Reason ignored |
| --- | --- | --- |
| `7a8d24adfd6a49edb5132b9e53c3eee8` | Timeline Month - Light | Superseded by Light (Refined) |
| `9de6a897c3c74e2a88bcc56f1e5466d3` | Timeline Month - Dark | Superseded by Dark (Refined) |

### Meg

| Stitch source | Title | Reason ignored |
| --- | --- | --- |
| `50de58619601444cb1808d61208e0db1` | Meg - Dark Theme | Early unrefined draft |
| `7a50dd61f5e1420f95dd2e2b67e2da5a` | Meg - Light Theme | Early unrefined draft |
| `0cdd4d86758a4c5589af5856eed3f510` | Meg - Light (Refined) | Superseded by Premium Light |
| `1fb04d83a9304133a01b3411cd9b38f5` | Meg - Dark (Refined) | Superseded by Premium Dark (Refined) |
| `e3eb5bd0f3b045d6ac13e89266ec98b1` | Meg - Light (Consolidated) | Superseded by Premium Light |
| `f17385416d494ee2b1824aed196c7fe7` | Meg - Dark (Consolidated) | Superseded by Premium Dark (Refined) |
| `f63b7cccc2e34d44b9c11b46f278c339` | Meg - Conversational (Refined) | Intermediate alternate direction |
| `974e18a9aed3425085a47e586f3a677f` | Meg - Dark Conversational (Refined) | Intermediate alternate direction |
| `017bf5e1ba3b4ef1a1d53dd22f79782c` | Meg - Light (Companion Refined) | Superseded by Premium Light |
| `a758ca356bd54fea8d4df4d01f88ec7e` | Meg - Dark (Companion Refined) | Superseded by Premium Dark (Refined) |
| `d816e48cca28465d962244f7ccfd7ec0` | Meg - Premium Dark | Superseded by Premium Dark (Refined) |

### Strength

| Stitch source | Title | Reason ignored |
| --- | --- | --- |
| `ddb5a4a04de14679b4fa663b1cafc54c` | Strength Home - Light | Superseded by Refined Light |
| `e241d20104d34b27a280074a0a3061f0` | Strength Home - Dark | Superseded by Refined Dark |
| `bee08c1e48c74be7b472e56cf3000377` | Ready to Start - Light | Superseded by Ready to Start - Refined Light |
| `cb35e5162d0e48f2b170a52d6b8a260a` | Session Summary - Light | Superseded by Session Summary - Refined Light |

## Non-UI Stitch sources intentionally ignored

These 19 sources are desktop screenshots uploaded for reference/recon. They are not 390 px mobile compositions and are not treated as finalized Bloom screens.

| Visibility | Stitch source | Title | Dimensions |
| --- | --- | --- | --- |
| Visible | `3587622362643940313` | c669f3e0-187d-47ba-abe0-cc9ac2418f8d.png | 1920×1200 |
| Visible | `3587622362643940275` | image.png | 1920×1200 |
| Visible | `18057512779912671385` | image.png | 1920×1200 |
| Visible | `245778847529488042` | image.png | 1920×1200 |
| Visible | `245778847529487766` | image.png | 1920×1200 |
| Visible | `18057512779912674019` | image.png | 1920×1200 |
| Visible | `18057512779912674897` | image.png | 1920×1200 |
| Visible | `245778847529487904` | image.png | 1920×1200 |
| Visible | `18057512779912674603` | image.png | 1920×1200 |
| Visible | `18057512779912673141` | image.png | 1920×1200 |
| Visible | `245778847529487628` | image.png | 1920×1200 |
| Visible | `834564887493081614` | image.png | 1920×1200 |
| Visible | `18057512779912672263` | image.png | 1920×1200 |
| Hidden | `15557310349618086319` | image.png | 1920×1200 |
| Hidden | `15557310349618087747` | image.png | 1920×1200 |
| Hidden | `10163819580964300389` | image.png | 1920×1200 |
| Hidden | `938226132653364591` | Screenshot (587).png | 1920×1200 |
| Hidden | `5046160645404198950` | image.png | 1920×1200 |
| Hidden | `15557310349618087033` | image.png | 3840×2400 |

## Design resources

| Resource | Use |
| --- | --- |
| `9714451088767567490` — DESIGN.md upload | Stitch-side design reference; reconcile with the checked-in local `DESIGN.md`, which wins on token conflicts |
| `assets/224b3e9d0dd84a2b97aadcebe3b30164` | Stitch design-system instance; inventory only |
| `assets/bfa83a4be9654b318c3b65dcc58a8a75` | Stitch design-system instance; inventory only |

## Coverage gaps to normalize, not fabricate

- Timeline Year has no Stitch screen.
- Strength has no separate finalized light active-session, dark ready, dark summary, or refined camera-free/error generation.
- Log Period's shown dark-ended source renders with light colors despite its title; its hierarchy is selected, while the approved dark palette must be applied during implementation.
- Diet secondary flows have light-only sources and no separate finalized dark variants.
- App routes outside Today, Timeline, Log Period, Meg, Strength, and Diet have no finalized Stitch compositions in this project.

Those gaps will keep their real data and behavior and use the closest selected shell, navigation, spacing, typography, color, and state patterns from this mapping.

## Gate 1: real app architecture and behavior map

The existing authenticated runtime remains `AuthProvider → AppProvider keyed by UID → RootNavigator`. The provider key is an account-isolation boundary and must not change. `AppProvider` remains the owner of Firestore/device hydration, normalization, derived cycle values, UID-scoped persistence, optimistic state, and recoverable save errors.

| Route / state | Real component | Data and interactions to preserve | Stitch mapping | Main implementation risk |
| --- | --- | --- | --- | --- |
| Authenticated tab shell | `src/navigation/MainTabNavigator.js` | Today/Timeline/Meg/feature-flagged Strength/Diet routes; tab events; keyboard hide; safe area; reduced motion | Shared bottom navigation from all selected tab screens | Do not restore the older Insights/Learn/Profile destinations still mentioned in `DESIGN.md` |
| Today | `src/screens/TodayScreen.js` | Greeting/profile; current cycle; weekly check-ins/movement/sleep; guarded check-in launch; Daily Plan refresh; links to Timeline/Log Period | Today Refined v2 light/dark | Preserve duplicate-tap and recoverable check-in launch guards |
| Daily check-in | `src/screens/DailyCheckInScreen.js` | Three optional steps; legacy normalization; date/cycle context; synchronous save lock; Firestore save; retry without losing choices | No dedicated Stitch source; closest Today/Log Period form language | Keep route name and current normalized data shape |
| Timeline Month/Year | `src/screens/TimelineScreen.js` | Period/prediction/PMS/check-in model; month navigation; Year drill-down; Day Detail; cycle history; Log Period entry | Refined Month light/dark; no Year source | Never remove Year or replace real calculations with screenshot values |
| Day detail | `src/screens/DayDetailScreen.js` | Existing check-in, period, meal, movement detail/edit entry points | Closest Timeline detail/list pattern | Preserve all stack route names and date params |
| Log Period | `src/screens/LogPeriodScreen.js` | Create/edit by immutable ID or start date; ongoing/end state; start/end calendar; flow; validation; delete; save/error states | Selected ongoing/ended sources | Preserve period model, overlap/future validation, and transactional Firestore move |
| Meg | `src/screens/MegScreen.js` | Authenticated API; UID queue/merge; bounded context; drawer/history; mode; staged wait/reveal; retry/copy/feedback; check-in/settings/report/profile exits | Premium light/dark shell | Visual refactor must not change request/persistence/reveal ordering or safety behavior |
| Strength web | `src/features/strength/StrengthScreen.web.js` + `useStrengthSession.web.js` | Learn/select/safety/permission/calibration/ready/countdown/active/pause/summary; MediaPipe; smoothing; transform; rep state machine; cues/voice; privacy/outbox | Home, Ready, immersive Session, Summary, Camera-Free/Error | Real target stays 8; permission/privacy gate stays before camera; active state needs one immersive shell |
| Strength native | `src/features/strength/StrengthScreen.js` → `StrengthUnsupportedScreen.js` | Deliberate camera-free implementation; no native camera/module/permission | Camera-Free source normalized to refined shell | Do not add native camera access or duplicate a native pose engine during UI work |
| Diet home | `src/screens/DietScreen.js` | Single-tab `dietV31`; deterministic/offline rescue; forecast states; queued optimistic writes with rollback; SOS/Kit/Learn/Stats sheets; external-search recovery | Redesigned Home light/dark | Keep sheets local to the tab and preserve `dietV31`/write queue contracts |
| Craving Rescue / Rescue Kit | `SosSheet` / `KitSheet` in `DietScreen.js` | Debounced sheet open; backdrop/Back/Escape dismissal; focus restore; scrolling; local catalog and kit pricing | Craving Rescue / Rescue Kit light | Dark variants use the active shared palette; do not turn these into new routes |
| Meal Log | `src/screens/FoodScreen.js` | Template/manual logging; repeat/edit/delete/history; local-first save and best-effort cloud sync | Meal Log light | Add a Diet entry point without removing existing Day Detail entry points |
| Profile hub | `src/screens/ProfileScreen.js` | Activity/account view; Privacy, Doctor Report, Export, Reminders, Preferences; logout/reset/delete account recovery | No dedicated Stitch source | Normalize to shared list/screen shell; retain destructive confirmations and account reauthentication |
| Supporting stack routes | Article, Privacy, Reminders, Export, Preferences, Doctor Report, Food, Movement | Existing forms, data export, app-lock/preview, notifications, sharing, and recovery | No dedicated Stitch sources | Use `DESIGN.md` plus closest approved screen; fix scroll bounds without changing behavior |
| App privacy/splash | `src/navigation/RootNavigator.js`, `AppLockModal`, `SplashScreen` | Splash completion; app lock; screen-capture protection; navigation theme/transitions | No dedicated Stitch source | Preserve platform guards and privacy behavior |

### Protected service and data boundaries

- Do not change Auth/Firebase setup, Firestore paths/rules, user ownership, account isolation, or delete/reauthentication behavior.
- Do not change period prediction/validation, period/check-in/meal schema, daily plan derivation, or Diet recommendation/observation logic.
- Do not change Meg API authentication, context bounds, persistence idempotency, local queue, reveal, feedback, or safety handling.
- Do not change Strength detection, smoothing, transform, positioning, rep counting, cue/voice scheduling, privacy serializer, offline outbox, or summary schema.
- Route names and current params remain stable. Diet remains one tab with local sheets. Native Strength remains camera-free.

### Gate 1 issues to address during the UI pass

- Diet has no current entry point to the finalized Meal Log screen, although `FoodScreen` is already implemented.
- Food and Log Period lack the bounded web scroll shell already used by Diet/Profile/Doctor Report, matching prior embedded-preview scroll failures.
- Rapid Food/Log Period save taps rely only on React state timing; Meg retry also lacks the primary send lock.
- Strength summary storage rejection can escape as an unhandled async error; native/web camera-free presentation is inconsistent.
- The selected Strength active session is immersive, while the current tab bar always remains visible.
- Shared visual patterns are duplicated across screens: back buttons, safe-area/scroll/max-width shells, section headings, icon circles, choice chips, notices, and loading/error rows.
- `CalendarDatePicker` contains fixed white on-accent values instead of the central semantic palette.
- Legacy `InsightsScreen` and `LearnScreen` remain in source but are unreachable; they are not restored or deleted as part of this visual implementation.

Baseline before UI edits: `npm test` 181/181 passing, `npm run typecheck` passing, and `npm run build:web` passing.
