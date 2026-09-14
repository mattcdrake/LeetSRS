# LeetSRS

<div align="center">
<img src="assets/branding/LeetSRS_card%20large.png" alt="LeetSRS Logo" />
</div>

<br/>

LeetSRS is a [Chrome extension](https://chromewebstore.google.com/detail/odgfcigkohoimpeeooifjdglncggkgko?utm_source=item-share-cb) that adds spaced repetition to LeetCode problem practice.

## Screenshots

### In Extension

<div align="center">
<img src="assets/screenshots/mainScreen.png" width="30%" alt="Main Screen" />
&nbsp;&nbsp;
<img src="assets/screenshots/cardsScreen.png" width="30%" alt="Cards Screen" />
&nbsp;&nbsp;
<img src="assets/screenshots/statsScreen.png" width="30%" alt="Stats Screen" />
</div>

### Works directly on leetcode.com

<div align="center">
<img src="assets/screenshots/leetcodeScreencap.png" width="90%" alt="LeetCode Integration" />
</div>

## Features

### Spaced Repetition

- Uses **[TS-FSRS](https://github.com/open-spaced-repetition/ts-fsrs)** for the spaced repetition algorithm

### Review System

- Review queue ordered by due time
- View statistics and streaks
- Works directly on leetcode.com
- Easily rate after solving problems, or add to review later
- Optional editor reset when opening a problem from the review queue; other navigation preserves your code
- Customizable daily new card limits
- Daily limits, statistics, and streaks follow local calendar days beginning at midnight

### Cross-Browser Sync

- Optional sync via GitHub Gists
- Requires a GitHub token with `gist` scope—configure in Settings
- Your data stays in your own GitHub account

### Interface

- Dark/light theme support

## Open Source

LeetSRS is open source and accepts contributions.

## Installation

1. Download the latest release from the [Chrome Web Store](https://chromewebstore.google.com/detail/odgfcigkohoimpeeooifjdglncggkgko?utm_source=item-share-cb)
2. Or build from source and load as an unpacked extension

### Setting Up GitHub Gist Sync (Optional)

<div align="center">
<img src="assets/screenshots/githubGistSyncScreen.png" width="30%" alt="GitHub Gist Sync settings screen" />
</div>

1. **Create a GitHub Personal Access Token** with the `gist` scope
2. Select **Create New Gist** and click **Save** in Settings, or select **Use existing Gist** and enter the ID of a Gist containing `leetsrs-backup.json` before saving. Saving the connection turns on syncing.
3. The token, Gist ID, and syncing setting sync via Chrome when browser sync is enabled; otherwise configure the connection on each browser. Learning data and stored preferences sync together through Gist.

Sync uses last-write-wins for the entire dataset, not per-card merging. The browser with the newest edit replaces all Gist data, so concurrent changes in another browser can be lost. Enabled sync runs after local edits, when the extension starts, and at least once per minute for retry.

## Setup

Use Node.js 24+.

```sh
npm install
npm run dev
```

`npm run build` creates a production extension in `.output/chrome-mv3/`; load that directory as an unpacked extension in Chrome. `npm run zip` packages it for distribution.

See [AGENTS.md](AGENTS.md) for development checks and workflow rules, and [Architecture](docs/architecture.md) for system boundaries.

## License

[MIT](LICENSE.md) · [Privacy](PRIVACY.md) · [Changelog](CHANGELOG.md)
