# Changelog

Notable changes to Pulso, newest first. Releases before 1.0.0 are on the
[releases page](https://github.com/Zovaris/Pulso/releases).

## 1.0.0 — 2026-10-24

The first stable release. Command detection, process supervision and the
history are unchanged from 0.3.0; this release finishes the appearance work
and settles the UI.

### New

- Three more palettes — Nord, Rosé Pine and Catppuccin — each with a light and
  a dark side, alongside Pulso's own.
- Palette swatches in Settings, so the choice reads as colour instead of a name.
- The menu bar menu wears the active palette instead of the system greys.

### Improved

- Switching appearance in System Settings reaches both windows immediately,
  with no reload.
- The default editor picker is keyboard-driven and follows the palette.
- Dropdowns cap their height and scroll instead of running off the window.

### Fixed

- Stop and retry from the menu bar respond on the first click again.
- The favicon is generated from the current mark, so the retired one stops
  shipping.

### Notes

- macOS on Apple Silicon. The build is ad-hoc signed but not notarized:
  right-click the app and choose Open on first launch.
- Compare: https://github.com/Zovaris/Pulso/compare/v0.3.0...v1.0.0
