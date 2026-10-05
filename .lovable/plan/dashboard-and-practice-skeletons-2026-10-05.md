# Dashboard and Practice Skeletons

## Goal
Replace the current centered loading spinners with dedicated placeholders that mirror the existing Dashboard and Practice pages, then dissolve loaded content in over 180ms without changing the current colors, typography, spacing, card shapes, or page layout.

## Changes
- Add a reusable skeleton primitive that uses the existing glass surfaces and semantic theme colors.
- Add a Dashboard skeleton matching the current header, welcome area, stat cards, daily-goal panel, live reminder, subject grid, quick actions, and recent activity.
- Add a Practice skeleton matching the current header, question progress row, progress bar, question panel, answer rows, and action area.
- Use the Practice skeleton in both chapter-based and topic-based practice pages.
- Apply a 180ms content fade-in to the loaded Dashboard and Practice screens, with reduced-motion support.
- Keep empty, completed, and error states unchanged.

## Technical details
- Skeletons will preserve the same responsive grid widths and stable minimum heights as the real content to prevent layout shift.
- Animation will affect opacity only, avoiding movement or scale that could alter perceived layout.
- Existing database queries and page behavior will remain unchanged.

## Verification
- Confirm the project builds without errors.
- Check Dashboard and Practice at desktop and mobile widths for matching structure, no overlap, and no visible layout jump.
- Confirm reduced-motion users receive an immediate, non-animated transition.
