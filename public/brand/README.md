# Oracle application icons

This directory contains the single approved Oracle icon family extracted from
the supplied concept image without generative re-rendering.

- `oracle-full.png`: complete wheel, tents, and ribbon logo.
- `oracle-square-512.png`: square full-logo treatment.
- `oracle-app-icon-*`: application icons at 192, 256, 512, and 1024 pixels.
- `oracle-wheel-*`: detailed round marks from 16 through 256 pixels.
- `oracle-compact-*`: alternate compact marks from 16 through 128 pixels.
- `oracle-o-16.png` and `oracle-pointer-16.png`: small favicon alternatives.

All PNG files use alpha transparency. The application header uses the 64-pixel
wheel, while `index.html` uses the dedicated 16- and 32-pixel favicon exports
from `public`.

## Animated Oracle logo

`oracle-animation/` contains web-ready exports derived from
`animated-hero.mp4`. The source video is cropped to the logo composition and a
frame-by-frame, edge-connected color matte removes only exterior background
pixels. This preserves enclosed black artwork such as the center “O” and wheel
shadows. The opening transition reuses the first settled silhouette to remove
the source video’s expanding black background circle without keying dark wheel
wedges or curtain details.

- `oracle-animated.webm`: primary VP9 animation with alpha.
- `oracle-animated.webp`: animated WebP fallback with alpha.
- `oracle-animated.png`: lossless APNG archival fallback with alpha.
- `oracle-poster.png`: transparent first-frame poster.
- `oracle-static.png`: reduced-motion fallback derived from `oracle-full.png`.

Run `node scripts/process-oracle-animation.mjs` after temporarily making
FFmpeg, FFprobe, and `pngjs` available. The processing script documents the
crop and spatial matte used to produce the checked-in assets.
