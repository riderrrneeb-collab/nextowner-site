# NextOwner daily ad

`node tools/ad/make-ad.mjs --date 2026-11-14 --out ad.mp4` renders a 15s 1080x1920 ad with music.
Each date picks its own hook, featured listing, cards, words, colors and music, so every day's video is different.
Add `--frames 1,3,5` to save preview stills instead of a video.

Needs Node with playwright (Chromium), ffmpeg, python3 with numpy. Uses the "Inter Display" font if installed.
