# Solvo Timer

A speedcubing timer that runs entirely in the browser. No server, no build step.

## Features
- WCA-style timer: 15 s inspection with beeps or voice callouts (English / Tiếng Việt), +2 / DNF rules, touch support
- Random-state scrambles for 3×3 and 2×2 (own two-phase solver in a Web Worker), random-move for 4×4 / 5×5
- ao5 / ao12 / ao50 / ao100, session goals, Sub-X ladder, customisable layout (Simple / Full / Arrange)
- Analytics: progress, distribution, records, training-day heatmap, fastest hour, Sub-X per month
- Virtual 3×3 cube with replays split into Cross / F2L / OLL / PLL, TPS graph and WebM export
- Ghost race against your best or last replay, with live phase splits
- Train: OLL (57) and PLL (21) trainer with weighted case picking, cross trainer with optimal solutions (colour neutral), metronome
- Coach: daily missions with XP and streaks, lookahead score, phase balance, 41 badges
- Share cards (9:16 or 1:1 PNG) for TikTok / Instagram
- Competition practice (WCA average of 5) and a seeded weekly challenge
- GAN smart cube and GAN Smart Timer over Web Bluetooth (Chrome / Edge, https only)
- Installable as an app (PWA) and works offline
- Polished feel: animated 3D cube turns, progress ring for hold and inspection, gold PB moment with chime, vibration on phones, last-solve delta, interactive chart tooltips (click a point to open the solve), colour-coded scramble with step-by-step preview
- GPU backgrounds: 10 WebGL shader scenes (Nebula, Aurora, Liquid Chrome, Hyperdrive, Synthwave, Rubik Field, Voronoi Glass, Spiral Galaxy, Electric Storm, Ink Swirl) that react to the timer: they speed up while you solve, glow red while you hold, green when you can go, flash when inspection runs late and turn gold on a PB. Resolution adapts to keep 60 fps, and browsers without a fast GPU get 2D versions
- Effects: shockwave and warp streaks when the clock starts and stops, fireworks for PBs and badges, the virtual cube spins apart and back together when solved, glitch on DNF, glowing time while solving, cursor trail, card tilt and spotlight (each one can be turned off in Settings → Effects)
- 13 one-tap themes and 7 timer fonts (Wide, Arena, Bold, Thin, Stackmat, Futuristic, Mono), typography in Unbounded, Manrope and Geist Mono, gradient glass cards, bottom tab bar on phones, keyboard shortcuts overlay (press ?)
- Import csTimer exports; export JSON / CSV

The shared weekly leaderboard and live 1v1 battles need the Claude-hosted version (they use Claude's shared storage and rooms). On this site your data is stored in your browser; export a JSON backup from Settings → Import & export.

## Run locally
Serve the folder over http (the scramble worker and the service worker need it):

    python3 -m http.server

then open http://localhost:8000.

## Deploy
Any static host works: GitHub Pages, Netlify, Cloudflare Pages. Bluetooth and app install need https, which all of these provide.

## Credits
Smart cube support uses [gan-web-bluetooth](https://github.com/afedotov/gan-web-bluetooth) (MIT), loaded from jsDelivr only when you connect a device.
