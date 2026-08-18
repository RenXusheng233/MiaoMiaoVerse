# Task 1 Report: Theme Resolution and Global Switching

## Implementation

- Added `resolveTheme()` with the public `ResolvedTheme` type and the `miaomiaoverse-theme` storage key.
- Added a synchronous bootstrap script that resolves persisted or system theme preference before hydration, toggles the root `.dark` class, and sets `color-scheme`.
- Added the fixed global theme button with the required static `aria-label`; it persists manual selections and stops responding to system preference changes after a manual selection.
- Mounted the button and `next/script` bootstrap in the root layout, using `strategy="beforeInteractive"`, and added `suppressHydrationWarning` to `<html>`.

## Files

- `frontend/lib/theme.ts`
- `frontend/lib/theme.test.ts`
- `frontend/components/theme-toggle.tsx`
- `frontend/app/layout.tsx`

## Tests and TDD Evidence

- RED: `cd frontend && bun test lib/theme.test.ts` failed before implementation because `./theme` did not exist: `0 pass`, `1 fail`, `1 error`.
- GREEN: the same focused command passed after the minimal helper implementation: `2 pass`, `0 fail`, `5 expect() calls`.
- Verification: `bunx tsc --noEmit`, `bun lint`, and `bun run build` all exited successfully. The production build compiled, type-checked, and generated all eight routes.

## Self-Review

- Confirmed persisted `light` and `dark` values override system preference; `null`, empty, and invalid values fall back to it.
- Confirmed the bootstrap uses the specified storage key and the root layout uses `beforeInteractive`, which Next.js emits in the document head.
- Confirmed the toggle is fixed in the upper right, has exactly `aria-label="切换亮暗主题"`, writes manual choices to storage, and ignores later system media-query events after manual interaction.
- Confirmed no backend, API type, environment, or non-theme page structure files were changed.

## Concerns

- The frontend does not install Bun test type declarations. The TypeScript test import is therefore annotated with a scoped `@ts-expect-error`; Bun executes the test normally, and `tsc` remains clean without introducing a dependency.
