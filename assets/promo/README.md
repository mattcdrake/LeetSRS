# LeetSRS README images

The images the repository README shows. The banner, Chrome button, and solve/rate/review image come from the [LeetLanding repository](https://github.com/mattcdrake/LeetLanding/tree/main/assets/promo); copy updated renders here. The matching Firefox button has a local [HTML source](add-to-firefox.html), adapted from the Chrome button with the Simple Icons Firefox Browser mark from `react-icons/si`.

| Image                                        | Size       |
| -------------------------------------------- | ---------- |
| [README banner](readme-banner.png)           | 1600 × 480 |
| [Chrome install button](add-to-chrome.png)   | 584 × 104  |
| [Firefox install button](add-to-firefox.png) | 584 × 104  |
| [Solve, rate, review](02-loop.png)           | 1280 × 800 |

The banner displays at 800 pixels wide and both install buttons at 292 × 52; all three are 2× PNGs with transparent rounded corners.

To regenerate the Firefox button, open its HTML source in Chromium at a 584 × 104 viewport, wait for `document.fonts.ready`, and take a PNG screenshot with `omitBackground: true`. The source loads Geist from Google Fonts, so rendering requires network access.
