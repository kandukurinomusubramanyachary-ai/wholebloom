# Bloom Design System

## Direction

Bloom adapts Airbnb’s generous, human consumer-product language to private health tracking. The interface uses a clean white canvas, modest type weights, generous whitespace, familiar controls, and one concentrated Bloom rose accent. Photography is not required for the daily product experience; hierarchy comes from spacing, typography, and clear state.

This is inspiration, not an Airbnb clone. Bloom’s identity is the supplied rose lotus and lowercase geometric wordmark. Sage and blush remain reserved for semantic body states.

Design settings:

- Visual variance: 5/10
- Motion intensity: 3/10
- Visual density: 4/10
- Theme: user-selectable light or dark; light remains the default
- Color strategy: restrained

## Color

| Token | Value | Use |
| --- | --- | --- |
| Canvas | `#FFFFFF` | App background and primary surfaces |
| Surface soft | `#F7F7F5` | Grouped controls, inactive chips, subtle bands |
| Surface warm | `#FBF3EF` | Cycle context and gentle highlights |
| Ink | `#222222` | Primary text and active navigation |
| Body | `#484848` | Supporting copy |
| Muted | `#6A6A6A` | Secondary labels and metadata |
| Hairline | `#E5E5E2` | Dividers and quiet borders |
| Logo rose | `#ED3F5B` | Lotus artwork, wordmark pairing, and branded opening moments |
| Logo ink | `#1D1D1B` | Lowercase Bloom wordmark |
| Brand | `#B52F50` | Accessible primary actions, current selection, focus, key cycle moments |
| Brand soft | `#FBE5EA` | Selected surfaces and quiet emphasis |
| Cycle | `#C0755A` | Period visualization without alarm language |
| Sage | `#60745C` | Positive status text and today marker |
| Sage soft | `#E7ECE4` | Success and care-tip surfaces |
| Blush soft | `#F4E6E6` | Gentle forecast and cycle-range surfaces |
| Error | `#B42318` | Destructive confirmation and inline validation only |

Primary buttons use Brand with white text. The darker brand token is intentional so button labels meet contrast requirements. Bright red is never used for cycle status.

### Dark theme

Dark mode is designed for private evening check-ins in low ambient light. It uses a rose-tinted near-black canvas (`#121113`), distinct soft and raised surfaces (`#1B191C` and `#242126`), warm white ink (`#F7F4F5`), and a brighter Bloom rose (`#EE718B`) for selection and focus. Semantic cycle and sage colors are lifted rather than desaturated so they remain legible without feeling clinical.

The dark palette follows the same restrained rules as light mode: accent color is reserved for actions and current state, borders stay quiet, and surfaces—not shadows—carry most grouping. Body, muted, accent, error, and success text all meet WCAG AA contrast against the dark canvas. Users choose Light or Dark in Profile → Personalisation; the choice is stored with their UID-scoped device settings.

## Typography

Use one familiar humanist sans family throughout, matching Airbnb Cereal’s calm proportions without copying a licensed font.

- iOS: system / Avenir Next where available
- Android: `sans-serif`
- Web: Inter, system-ui, Segoe UI, Roboto, sans-serif

| Role | Size | Weight | Line height |
| --- | --- | --- | --- |
| Screen title | 28 | 700 | 34 |
| Section title | 20 | 600 | 26 |
| Component title | 16 | 600 | 22 |
| Body | 15 | 400 | 22 |
| Supporting | 14 | 400 | 20 |
| Caption | 12 | 500 | 16 |
| Button | 16 | 600 | 20 |

Avoid display serifs inside the product UI. Headings should feel warm through copy, spacing, and modest weight rather than decorative typography.

## Shape

- Cards and grouped surfaces: 16 point radius
- Inputs and standard buttons: 12 point radius
- Chips, filters, and compact status controls: full pill
- Icon buttons: circular
- Touch targets: 48 points preferred, 44 points minimum

Do not over-round full sections. Use full pills only where the control’s compact, selectable nature benefits from it.

## Spacing

Use a 4 point base with the following working scale:

- 4: micro gap
- 8: compact gap
- 12: related control gap
- 16: standard component spacing
- 20: screen gutter on mobile
- 24: card padding and section gap
- 32: major screen rhythm
- 48: opening screen and empty-state breathing room

Content caps at 720 points on wide web layouts. The mobile app remains the primary composition.

## Elevation

Most surfaces are flat. Separate groups with whitespace, a subtle fill, or one hairline border.

Use a single restrained shadow only for transient or truly elevated surfaces:

- offset: 0 by 2
- blur: 8
- opacity: 0.08

Do not combine a wide soft shadow and a border on the same decorative card.

## Components

### Brand mark

Use the outlined Bloom lotus with the lowercase geometric `bloom` wordmark. The lotus uses Logo Rose and the word uses Logo Ink on light surfaces; both use white when reversed. The full stacked lockup belongs on the opening screen, while compact horizontal or symbol-only forms serve headers and navigation.

### Primary button

- Brand fill, white label
- 48 to 52 point height
- 12 point radius
- Full width for core check-in actions
- Press feedback: opacity plus scale to 0.98
- Disabled: neutral surface and readable muted label

### Secondary button

- White or Surface soft fill
- Ink label
- One Hairline border
- Same dimensions as the primary button

### Cards

Cards are reserved for real grouping: a cycle summary, a check-in module, an insight, or an article. Prefer open sections and dividers for lists and settings.

### Inputs

- 56 point minimum height
- White fill with Hairline outline
- 12 point radius
- Ink label and text
- Brand focus outline
- Placeholder contrast must remain readable
- Inline helper/error copy, never color alone

### Selection controls

Mood, flow, symptoms, and filters use pill chips or compact tiles. Selected state combines Brand/Brand soft with an icon or check mark. Unselected states stay neutral.

### Bottom navigation

Use one outlined icon family. Active state uses Ink plus a small Brand indicator; inactive icons and labels use Muted. Avoid emoji navigation. Preserve five destinations: Today, Timeline, Insights, Learn, Profile.

## Core Screen Composition

### Today

1. Compact greeting and date
2. One cycle-context surface with day and phase
3. One clear daily check-in action or completed summary
4. A short affirmation and one gentle tip

The check-in expands progressively and keeps the save action visible at the end. Required mood selection must be obvious without feeling corrective.

### Timeline

Use a generous monthly calendar with clear text legend. Period, today, forecast, and check-in states must each have shape or icon support in addition to color. Cycle copy avoids late or missed.

### Insights

Lead with one useful observational sentence. Use progress visuals only where the measure is meaningful. When fewer than 14 check-ins exist, teach the user what data will unlock rather than displaying empty charts.

### Learn

Use an Airbnb-like browse rhythm: horizontal categories, generous article rows, clear reading time, and restrained bookmark controls. Avoid identical floating card grids.

### Profile and settings

Use grouped list sections with dividers, not stacked cards. Privacy should be a first-class destination. Destructive data deletion is visually separated and requires confirmation.

### Opening screen

Open with the centered stacked logo on `#FFFDFE` and a 110-point hairline progress indicator. The logo fades in with an 8-point rise while the line completes in 2.2 seconds, then the app enters Today directly. Reduced motion keeps the logo still and shortens the opening state.

## Motion

- Standard state transition: 180 to 220ms with `cubic-bezier(0.23, 1, 0.32, 1)`
- Press: scale to 0.98 for 100â€“120ms; release is slightly slower at 150ms
- Hover: color or the single elevation tier only; lift is reserved for clearly clickable content
- Expand/collapse: opacity plus a 6â€“10 point vertical reveal, never bounce
- Save success: subtle icon/state change and optional light haptic
- Reduced motion: remove position and scale changes; keep an instant state change or short crossfade

### Purposeful choreography

Bloom has one signature scroll moment: Todayâ€™s cycle context moves by at most 12 points as the user scrolls, keeping the current body context spatially connected to the day. Supporting sections may reveal once at 90% opacity with a 10 point offset; primary task content is always immediately readable.

Moving selection surfaces explain tab changes in the bottom navigation, Timeline Month/Year switch, and Insights/Learn switch. New Meg messages and the typing state animate because they represent incoming state. The branded opening fade is the only launch choreography. Settings, repeated calendar navigation, and routine logging never receive decorative choreography.

Only transform and opacity animate in JavaScript. Web hover and focus transitions are bounded to 150â€“190ms. No interaction waits for motion to finish.

No orchestrated page-load animation, decorative confetti, or motion that delays logging.

## Voice

Use validating, observational language:

- “How is your body feeling today?”
- “Your pattern has varied this month. That can be part of PCOS.”
- “You tend to feel more tender after shorter sleep.”
- “Bloom is here when you are ready.”

Avoid:

- abnormal, late, missed, failed, fix, cure
- fertility pressure
- weight-shaming language
- streak guilt
- diagnostic certainty
