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
- View streaks
- Works directly on leetcode.com
- Easily rate after solving problems, or add to review later
- Optional editor reset when opening a problem from the review queue; other navigation preserves your code
- Customizable daily new card limits
- Daily limits and streaks follow local calendar days beginning at midnight

### Cross-Browser Sync

- Optional sync via GitHub Gists
- Sign in with GitHub and choose a backup in Settings
- Your data stays in your own GitHub account

### Interface

- Dark/light theme support

## Open Source

LeetSRS is open source and accepts contributions.

## Installation

1. Download the latest release from the [Chrome Web Store](https://chromewebstore.google.com/detail/odgfcigkohoimpeeooifjdglncggkgko?utm_source=item-share-cb)
2. Or build from source and load as an unpacked extension

### Setting Up GitHub Gist Sync (Optional)

1. Select **Sign in with GitHub** in Settings. Signing in does not enable sync.
2. Choose an existing backup or **Create New Gist**, then select **Connect and sync**.
3. Sign in and select the same backup separately on each browser. Credentials and the selected destination stay local to each installation.

Use the sync toggle to pause syncing. **Sign out** removes the local connection and credentials while keeping learning data and remote Gists. Upgrading from PAT setup requires signing in again; your previous backup is suggested only if it belongs to your account.

Sync uses last-write-wins for the entire dataset, not per-card merging. The browser with the newest edit replaces all Gist data, so concurrent changes in another browser can be lost. Enabled sync runs after local edits, when the extension starts, and at least once per minute for retry.

## Setup

Use Node.js 24 or newer and install dependencies with `npm install`.

- `npm run dev`: start Chrome with a fresh temporary profile.
- `npm run dev:persistent`: reuse a Chrome profile, keeping logins and extension data between runs.
- `npm run dev:reset`: delete the persistent development profile, including its logins and extension data. Stop the dev server and close the development browser first.
- `npm run build`: build the production extension.
- `npm run zip`: package the extension for distribution.

The persistent profile lives in `.wxt/chrome-data`, which Git ignores. Fresh runs leave it untouched.

## License

[MIT](LICENSE.md) · [Privacy](PRIVACY.md) · [Changelog](CHANGELOG.md)
