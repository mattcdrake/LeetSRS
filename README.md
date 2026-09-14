# LeetSRS

A browser extension for practicing LeetCode problems with spaced repetition. Track reviews, notes, and progress, with optional GitHub Gist sync.

## Setup

Use Node.js 24+.

```sh
npm install
npm run dev
```

`npm run build` creates a production extension in `.output/chrome-mv3/`; load that directory as an unpacked extension in Chrome. `npm run zip` packages it for distribution.

See [AGENTS.md](AGENTS.md) for development checks and workflow rules, and [Architecture](docs/architecture.md) for system boundaries.

[License](LICENSE.md) · [Privacy](PRIVACY.md) · [Changelog](CHANGELOG.md)
