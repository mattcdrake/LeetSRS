# LeetSRS promo assets

Promotional images, logos, and social cards for LeetSRS.

| Asset                                         | Size       |
| --------------------------------------------- | ---------- |
| [Practice plan](01-practice-plan.png)         | 1280 × 800 |
| [Roadmaps](02-roadmaps.png)                   | 1280 × 800 |
| [LeetCode workflow](03-leetcode-workflow.png) | 1280 × 800 |
| [Review calendar](04-review-calendar.png)     | 1280 × 800 |
| [Local practice and sync](05-local-sync.png)  | 1280 × 800 |
| [Small promo](small-promo.png)                | 440 × 280  |
| [Marquee](marquee.png)                        | 1400 × 560 |
| [README banner](readme-banner.png)            | 1600 × 480 |
| [README demo](demo.gif)                       | 800 × 622  |

The five `*-preview.png` files are 640 × 400 readability previews.

The README banner displays at 800 pixels wide, with a 2× PNG for sharp text. Its [SVG source](readme-banner.svg) contains outlined typography so it renders consistently without installed fonts. It combines the logo, “Spaced repetition for LeetCode,” and the approved tagline.

The README demo is a silent, looping GIF of the full [source recording](https://github.com/mattcdrake/LeetLanding/blob/main/src/assets/video/screencast.mp4), approximately 25 seconds at 8 fps. Regenerate it from the landing repository with FFmpeg:

```sh
ffmpeg -i src/assets/video/screencast.mp4 -an \
  -filter_complex '[0:v]fps=8,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle' \
  -loop 0 assets/promo/demo.gif
```

- `logos/`: SVG source and PNG icons at 16, 32, 48, 60, 96, and 128 pixels. The 32px icon also serves as the website favicon.
- `social/`: the 1200 × 630 social preview PNG and editable SVG source.
