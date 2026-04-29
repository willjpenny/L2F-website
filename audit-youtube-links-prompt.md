# Audit Prompt — YouTube Channel Links on listeningtofamilies.co.nz

## Task

Audit every video on the current live website at https://listeningtofamilies.co.nz and determine which YouTube channel each video is hosted on.

## Background

The LTF website embeds videos from YouTube. There is one **main YouTube channel** and multiple **individual specialist channels**. We believe all videos currently on the website point to individual specialist channels, not the main channel — but we need to confirm this before making all videos on the main channel private (which would break any video still linked from the site).

## What to do

1. Crawl every topic/video page on listeningtofamilies.co.nz and collect every YouTube video ID found in iframes, embeds, or links.
2. For each video ID, fetch the YouTube watch page (https://www.youtube.com/watch?v=VIDEO_ID) and scrape the channel name and channel URL from the page — no API key needed, this is publicly visible on every YouTube video page.
3. Identify the main LTF channel by checking https://listeningtofamilies.co.nz for any link to their YouTube channel, or note it from context (it will be a channel with ~600 videos, not a specialist's personal channel).
4. Flag any videos on the website that belong to the main channel rather than an individual specialist channel.

## Output needed

- Total number of videos found on the site
- A list of any videos that point to the main channel (these would break if the main channel goes private)
- Confirmation if zero videos point to the main channel (safe to proceed)
- A breakdown by channel if possible (which specialist channels are represented and how many videos each)

## Notes

- Do not make any changes to YouTube or the website — this is read-only audit only
- No API key is required — all information is publicly accessible by scraping YouTube watch pages
