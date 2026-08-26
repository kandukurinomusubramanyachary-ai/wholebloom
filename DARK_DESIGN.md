# Bloom Dark Mode

This document extends `DESIGN.md`. It describes the same Bloom product in low ambient light; it does not create a second visual identity.

## Direction

Dark mode is calm, warm, private, and restrained. Rose, sage, and cycle colors retain their existing meanings. Near-black rose-tinted surfaces reduce glare, while surface steps and quiet borders preserve hierarchy without bright floating cards or decorative glow.

Light remains the default. Signed-in users choose Light or Dark in Profile → Personalisation. The UID-scoped choice applies immediately and persists without changing navigation or health data.

## Semantic mapping

| Semantic token | Light | Dark | Use |
| --- | --- | --- | --- |
| `canvas` | `#FFFEFF` | `#121113` | App and screen background |
| `splash` | `#FFFDFE` | `#0F0E10` | Branded opening surface |
| `surfaceSoft` | `#F7F7F5` | `#1B191C` | Grouped controls and quiet sections |
| `surfaceStrong` | `#F1F1EE` | `#242126` | Raised and selected neutral surfaces |
| `surfaceWarm` | `#FBF3EF` | `#23191C` | Warm cycle context |
| `ink` | `#222222` | `#F7F4F5` | Primary text |
| `body` | `#484848` | `#DED8DB` | Body copy |
| `muted` | `#6A6A6A` | `#B7AFB3` | Metadata and placeholders |
| `hairline` | `#E5E5E2` | `#343035` | Dividers and quiet borders |
| `borderStrong` | `#B9B9B4` | `#514A50` | Focus-adjacent and selected borders |
| `brand` | `#B52F50` | `#EE718B` | Primary action and current state |
| `brandHover` | `#A62A48` | `#F17F96` | Pointer hover |
| `brandActive` | `#92243F` | `#D95D78` | Pressed action |
| `brandSoft` | `#FBE5EA` | `#321C23` | Selected rose surface |
| `cycle` | `#C0755A` | `#D78A70` | Period and cycle state with shape/text support |
| `sage` | `#60745C` | `#9DB296` | Positive and care status |
| `sageLight` | `#E7ECE4` | `#1E2920` | Positive surface |
| `blush` | `#F4E6E6` | `#342328` | Gentle forecast surface |
| `warning` | `#9A651E` | `#F0B45C` | Warning with icon and copy |
| `error` | `#B42318` | `#FF8B81` | Error/destructive state with icon and copy |

All palettes expose identical keys. Screens consume semantic tokens through `COLORS` and `createThemedStyles`; screen-specific dark palettes and global inversion are not permitted.

## Surfaces and components

- Canvas contains open content. `surfaceSoft` groups controls; `surfaceStrong` separates selected or raised neutral content. Borders, rather than heavy shadows, carry most depth in dark mode.
- Cards preserve their light-mode structure. Neutral cards use dark semantic surfaces, while rose, sage, blush, and cycle cards use their semantic soft surfaces.
- Primary buttons use `brand` with the palette’s inverted `white` token. Secondary buttons use the neutral raised surface plus `hairline`. Disabled controls use `surfaceSoft` and readable `muted` labels.
- Inputs use a dark neutral fill, visible `hairline`, `ink` input text, readable `muted` placeholders, and a rose focus outline. Error copy always includes an icon or explanatory text.
- Chips combine fill and border with an icon, check mark, or radio state. Color is never the only selected-state signal.
- Modal and bottom-sheet surfaces remain distinct from canvas through `surfaceStrong`, a quiet border, and the one restrained elevation tier only when transient elevation is necessary.

## Navigation and system surfaces

React Navigation receives dark-aware background, card, text, border, primary, and notification colors. The bottom dock uses semantic surfaces and preserves its active dot plus text/icon weight. Status-bar content switches to light over dark authenticated screens and dark over light screens. Keyboard appearance remains platform controlled.

Switching themes updates the active palette in place. It does not remount the provider, reset navigation, replay screen motion, or alter user data. Reduced-motion behavior remains unchanged.

## Calendar, charts, Meg, Diet, and Strength

- Calendar and chart states retain labels, shapes, icons, or patterns in addition to cycle/sage/rose color. Grid lines use `hairline`; labels use `body` or `muted` at accessible contrast.
- Meg’s conversation canvas, input, suggestions, messages, loading, errors, and long-history controls use semantic surfaces. The dark history drawer is an intentional persistent dark surface in both themes; its text remains warm and readable.
- Diet and health-state surfaces retain rose/sage/cycle meaning. Observation, warning, and error language remains explicit and is never conveyed by tint alone.
- Strength uses the same canvas and component hierarchy. The live camera remains a purposefully dark media surface in either theme, with persistent text indicating that processing stays on-device. Skeleton overlay colors are fixed for camera contrast and are never persisted.

## Accessibility

Normal text must reach 4.5:1 contrast; large text, focus indicators, and major graphics must reach 3:1. The core `ink`, `body`, `muted`, brand-button label, warning, error, and sage combinations are regression-tested. Touch targets remain at least 44 points. Focus, loading, disabled, selected, warning, and error states include a non-color signal. Motion rules and reduced-motion support are identical to `DESIGN.md`.

## Intentional exceptions

The unauthenticated opening and authentication flow remain intentionally light branded surfaces because no signed-in preference is available yet. During signed-in hydration, the opening screen prevents authenticated content from flashing before the UID-scoped theme is known. The camera preview is always near-black because it is a media viewport, not an app canvas.

## Correct and incorrect usage

- Correct: `backgroundColor: COLORS.surfaceSoft`; incorrect: choosing a new dark hex inside a screen.
- Correct: selected chip uses rose surface, border, and check icon; incorrect: changing text color alone.
- Correct: warning uses `warning`, an alert icon, and recovery copy; incorrect: an amber rectangle without explanation.
- Correct: open sections and quiet dividers; incorrect: white cards floating over a dark canvas or glowing rose borders.
