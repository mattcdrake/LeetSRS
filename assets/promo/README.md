# LeetSRS README images

The images the repository README shows. The banner and solve/rate/review image come from the [LeetLanding repository](https://github.com/mattcdrake/LeetLanding/tree/main/assets/promo); copy updated renders here. The matching install buttons have local HTML sources for [Chrome](add-to-chrome.html) and [Firefox](add-to-firefox.html), matching [LeetLanding PR #51](https://github.com/mattcdrake/LeetLanding/pull/51) at commit `c3276c0` (labels, typography, colours, borders, spacing, and icons). Their full-colour [browser logos](browsers/README.md) match the landing page assets.

| Image                                        | Size       |
| -------------------------------------------- | ---------- |
| [README banner](readme-banner.png)           | 1600 × 480 |
| [Chrome install button](add-to-chrome.png)   | 424 × 116  |
| [Firefox install button](add-to-firefox.png) | 412 × 116  |
| [Solve, rate, review](02-loop.png)           | 1280 × 800 |

The banner displays at 800 pixels wide and the Chrome and Firefox buttons at 212 × 58 and 206 × 58 respectively; all three are 2× PNGs with transparent rounded corners.

To regenerate either button, open its HTML source in Chromium at an 800 × 200 viewport with `deviceScaleFactor: 2`, wait for `document.fonts.ready` and the browser logo to load, and screenshot the `.install-button` element with `omitBackground: true`. Keep the viewport wider than 380 pixels to use the desktop styles. The source loads Geist from Google Fonts, so rendering requires network access.
