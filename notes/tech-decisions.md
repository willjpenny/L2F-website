# Technical Decisions

## YouTube — Continuous Autoplay
**Decision:** YouTube IFrame API with manual queue (Option B)

Use `onStateChange` to detect `YT.PlayerState.ENDED`, then call `loadVideoById()` with the next video ID from a queue built from Sanity data. Full control over order, custom UI possible.

**Why not playlist embed:** LTF video order comes from Sanity, not YouTube playlists.

**Gotcha:** First video requires user click (browser autoplay policy). Subsequent videos in the queue autoplay fine after that.
