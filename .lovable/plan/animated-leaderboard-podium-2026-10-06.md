# Animated Leaderboard Podium

## What will change
- Add a prominent leaderboard banner directly below the dashboard’s “Start practising” and “Join live mock” actions. It will show the active class leader from the same XP ranking used by the leaderboard and link to `/leaderboard`.
- Replace the leaderboard’s flat top-three rows with a responsive glass podium ceremony: bronze enters first, silver second, then the gold champion with crown, trophy, glow, confetti, and sparkle effects.
- Keep subject filtering intact. Changing a filter restarts the ceremony using that filter’s real top three.
- Add Skip and Replay controls. Skip immediately settles the podium and reveals ranks 4–100; Replay runs the sequence again.
- Handle fewer than three ranked students with clearly labeled open podium places rather than fabricated names.

## Motion and accessibility
- Use lightweight CSS transforms and opacity animations, plus a small React-driven stage timer; no video or canvas dependency.
- Keep the podium’s dimensions stable to avoid layout movement.
- Respect reduced-motion settings by showing the finished podium and rankings immediately.
- Preserve the existing colors, typography, glass surfaces, filters, and ranking logic.

## Verification
- Check the live page at desktop and mobile widths.
- Confirm dashboard navigation, filter changes, Skip, Replay, empty podium places, and the ranks 4–100 reveal.
- Confirm the app builds without errors.

## Technical details
- Create a focused reusable podium component and animation styles using existing semantic theme tokens.
- Keep database access unchanged and reuse the leaderboard’s current profile/attempt data.
- Update the dashboard’s existing class leaderboard query to retain the top student’s display data.
