# Notice

One inline feedback style for errors, warnings and confirmations.

Source: `popup/components/Notice.tsx`. Props: `tone` (`danger` | `warning` | `success` | `info`), `title`, optional `body` and `action`.

- Background is the tone's soft token (`danger-soft`, `warning-soft`, `brand-soft`; `info` uses `raised`); only the 14px Lucide icon takes the tone colour. Title stays `fg`, body `fg-2`, so text contrast never depends on the tone.
- `danger` and `warning` render `role="alert"`, `success` and `info` `role="status"`.
- `small` type, `radius-lg`, padding 8 × 10.
