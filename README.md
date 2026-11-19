<p align="center">
  <a href="https://axiondigital.co/">
    <img src="extension/icons/128.png" alt="SinBlocker Chrome image and video blocker by Axion Digital" width="128" height="128">
  </a>
</p>

# SinBlocker: Image and Video Blocker for Chrome

**Hide images, videos, and background media by default. Choose which sites you trust.**

SinBlocker is a Chrome extension for distraction-free browsing with a site
allowlist, custom URL rules, and SafeSearch controls. Keep media hidden on
unlisted sites, allow trusted websites, or reveal a single image or video
without turning off blocking everywhere.

**[Install SinBlocker](#installation)** · **[Usage guide](#usage)** · **[FAQ](#frequently-asked-questions)**

---

## Chrome image and video blocking features

| Feature | What you control |
| --- | --- |
| **Block media by default** | Hide media on unlisted sites; start with pre-included trusted sites. |
| **Website allowlist** | Allow individual hosts or include their subdomains. |
| **Advanced URL Rules** | Apply ordered allow/block overrides for host, path, and query conditions. |
| **Single-media reveal** | Right-click to show one hidden image or video. |
| **Quick controls** | Toggle blocking globally or manage the current site from the toolbar popup. |
| **Keyboard shortcut** | Press `Alt+I` to toggle global blocking when unlocked. |
| **Master lock** | Protect settings with a password or add friction with a challenge. |
| **SafeSearch enforcement** | Choose strict or moderate filtering for supported Google, Bing, DuckDuckGo, and Brave searches. |

> SinBlocker hides page media; it does not classify image content. Media and
> CAPTCHA exemptions apply, and it is not a guarantee that every image is hidden.

## How it works

Blocking only happens while the global toggle is on. Media is blocked by
default on every site except those matching your allowlist. Adding a site
allows its media; removing it restores blocking. An empty allowlist blocks
every site unless an enabled URL rule allows it. Common trusted sites are pre-included on first install.

### Advanced URL Rules

In options, add rules, select **Allow media** or **Block media**, build
drop-down conditions, then **Save rules**. Enable, edit, move, or delete
entries and save the complete list. Invalid collections, including disabled
rules, prevent saving without changing stored settings. Existing installations
start with no rules.

A rule matches when any condition line matches. Within a line, every
condition must match (And). The Or button starts a new line. Conditions
target `host`, `path`, or `query` with `equals`, `wildcard`, `does not equal`, `contains`,
`does not contain`, `starts with` or `ends with`.

The first enabled matching rule overrides the hostname allowlist. No match
retains the baseline; global blocking off always shows media. The popup shows
the effective status and disables its site action with **Rule Controlled**
when a rule matches. The master lock still protects edits and the global toggle.

Host comparisons ignore case but retain `www.`. Path and query use the URL's
encoded, case-sensitive fields; query excludes the leading `?`. Wildcard treats
`*` as zero or more characters across the whole value; equality, inequality,
and the other operators always match literally. No regular expressions or
JavaScript execution. Limits are 100 rules, 16 condition lines per rule, 32
conditions per line, and 1024 characters per value. Rules apply to top-level
documents; same-document SPA navigation is not tracked.

The extension uses `chrome.storage.local` to keep the toggle and allowlist in
sync across tabs, the popup, and the options page. All settings live in one
`IAVB_options` JSON blob with integrity-checked backups that restore the blob
if it is tampered with or deleted.

### Why block media by default?

- **100% site coverage by default:** no unlisted domain slips through the site
  decision, including new or obscure domains. Existing media and CAPTCHA
  exemptions still apply; this is not a guarantee that every image is hidden.
- **No stale external blocklist:** even 2.5-million-domain lists can be laggy,
  become outdated, and always have holes. An allowlist needs no external
  blocklist updates, and most common defaults are already included, keeping
  setup low-effort.

### Hiding before first paint

To prevent blocked media from flashing on screen while the page is still
loading, the blocking decision is applied in two layers:

1. **Persistent pre-hide registration.** The service worker turns the verified
   settings into a persistent `document_start` content-script registration that
   covers HTTP(S) pages while global blocking is on. On those pages a tiny
   `prehide.js` script immediately adds the `ivb-hide-images` class to the page
   `<html>` element before any image can paint. The registration covers every
   HTTP(S) host except those matching the allowlist when no URL rules are
   enabled. With enabled URL rules, it covers all HTTP(S) hosts, including
   allowlisted ones. Pre-hide never evaluates expressions; allowed pages may
   briefly hide media until verified settings load.
2. **Authoritative content script.** The full content script also runs at
   `document_start` and, after reading and verifying storage, reconciles the
   class against the shared URL evaluator, keeping toggle, allowlist, and rule changes
   in sync with pages that are already open.

`styles.css` performs the actual hiding: it hides media only when the
`ivb-hide-images` class is present. Images and videos use `opacity: 0` (not
`display: none`) so they stay in layout and remain right-clickable, while
embedded content and background images are removed with `display: none`.
Changing the toggle, allowlist, or URL rules rebuilds the registration for future
navigations and updates open tabs through the normal storage-change path.

### CAPTCHA widgets

Recognized reCAPTCHA, Cloudflare Turnstile, and `<altcha-widget>` containers
and their contents are excluded from media hiding. Standalone provider frames
must match an exact provider hostname and widget path, not a generic CAPTCHA
name. CSS matching handles widgets inserted after page load without changing
settings or forcing provider-controlled visibility.

Inline-background ancestors containing a recognized widget stay in layout,
but their backgrounds and unrelated media remain blocked. Programmatically
rendered reCAPTCHA frames are recognized by URL. Turnstile's closed shadow DOM
is protected through its container marker or generated response-field wrapper;
use a `.cf-turnstile` container with `data-sitekey` when disabling or renaming
that response field inside an inline-background wrapper.

CAPTCHA inside an unrelated cross-origin iframe remains unsupported because
the outer frame cannot be identified as a widget from the top document. These
exemptions use page markup, not an authenticity check; pages can imitate it.
The stylesheet uses CSS `@scope` and `:has()`, requiring Chrome 118 or newer.

### SafeSearch enforcement

SafeSearch uses packaged `declarativeNetRequest` rulesets, not page scripts.
The service worker enables the rulesets selected in the verified settings blob
and disables all other SinBlocker SafeSearch rulesets whenever settings change
or the worker starts. Matching top-level search requests have the engine's
filter parameter added or replaced before navigation. Already-compliant URLs
are explicitly allowed to prevent redirect loops.

Google exposes one supported URL filter level, so both SinBlocker levels use
Google's `safe=active`. Bing, DuckDuckGo and Brave Search have separate
strict and moderate rules. Yahoo and YouTube are excluded because they do not
expose a verified public URL control suitable for this request-level
enforcement.
Enforcement remains effective while Chrome keeps this extension installed and
enabled; managed Chrome policy and protected policy files are required to stop
a non-administrator from disabling it.

## Installation

### Build and load the Chrome extension

Use Chrome 118 or newer and Node.js 22 or newer. Build the unpacked extension
from locked dependencies:

```sh
npm ci
npm run build
```

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select `extension/`, not the repository root.

Rebuild after UI changes or changes to `src/background.js`, `src/content.js`,
or `src/store.js`, then reload the extension from the same page. Shared scripts
and assets in `extension/` are edited directly; no build is needed for those.
Existing storage persists across reloads; clear it only when testing first-run
or default behavior. Generated output is not committed.

For Linux administrator-managed installation, reuse an existing private key or
run `npm run src-keygen` once, then `npm run src-package`. Packaging requires Python 3
and OpenSSL. See [build documentation](docs/BUILD.md) and
[managed installation](scripts/MANAGED_INSTALL.md) for commands and key safety.

## Usage

- Click the toolbar icon to toggle blocking, add or remove the current site, or
  open options.
- Open the options page to manage the allowlist, choose subdomain matching,
  edit Advanced URL Rules, configure SafeSearch, and set a master lock.
- With Password Lock enabled, enter your password to access options. With
  Challenge Lock enabled, complete the configured challenge. Both modes disable
  the popup's global toggle and site actions.
- On a blocked site, right-click a hidden image or video and choose
  **SinBlocker: Show image/video** to reveal just that item.
- Press `Alt+I` to toggle blocking globally when the master lock is off.

## Frequently asked questions

### How do I block images and videos in Chrome?

Install SinBlocker, leave global blocking enabled, and remove any sites you do
not want in the allowlist. Media is hidden on unlisted sites unless an enabled
URL rule allows it. Use the toolbar popup to allow the current website.

### Can I show one image without allowing the whole website?

Yes. Right-click a hidden image or video and choose **SinBlocker: Show
image/video**. Other blocked media stays hidden. This reveal action does not
apply to hidden backgrounds, embedded content, or iframes.

### Does SinBlocker block every inappropriate image?

No. SinBlocker hides media based on website and URL settings, not visual
content analysis. Some media is intentionally exempt, including recognized
CAPTCHA widgets and certain icons, avatars, and emoji. SafeSearch adds
supported search-engine filtering but does not guarantee safe results.

### Where are my settings stored?

Settings are stored locally in Chrome using `chrome.storage.local`, with
integrity-checked backups. The allowlist and URL-rule decisions run in the
extension; they do not require an external domain blocklist.

### Can the master lock prevent the extension from being removed?

No. The master lock gates SinBlocker settings, not Chrome's extension manager.
Challenge Lock adds friction rather than authentication. Preventing a
non-administrator from disabling the extension requires managed Chrome policy.

## Project structure

| File             | Purpose                                                        |
| ---------------- | -------------------------------------------------------------- |
| `extension/manifest.json` | Extension wiring, permissions, command, and content scripts.   |
| `extension/background.js` | Service worker coordinator for tabs, messages, menus, and rules. |
| `extension/content.js` | Page-side blocker and right-click reveal logic.                 |
| `extension/prehide.js` | Adds the hide class at `document_start` before first paint.     |
| `extension/domain.js` | Shared hostname normalization and allowlist matching.          |
| `extension/url_rules.js` | Shared expression parser, collection validation, and URL policy. |
| `extension/safesearch.js` | SafeSearch setting normalization and ruleset selection.         |
| `extension/rules/` | Packaged SafeSearch request rules enabled by the service worker. |
| `extension/store.js` | Single `IAVB_options` settings blob with integrity backups.     |
| `extension/styles.css` | Selectors that hide page media.                                 |
| `src/input.css`  | Tailwind source for extension-page component classes.           |
| `extension/main.css` | Compiled Tailwind CSS linked by the extension pages.            |
| `src/popup.html/js` | Toolbar popup for global and per-site actions.                  |
| `src/options.html/js` | Options page for the allowlist, SafeSearch, and master lock. |
| `src/onboarding.*` | First-run explanation and start actions.                        |

See `AGENTS.md` for architecture details, the hostname matching contract, and
the manual verification checklist.

## Development

`npm run build` copies readable HTML/JavaScript into `extension/`, compiles
minified Tailwind CSS, and minifies the options and popup HTML.
Other runtime scripts and assets remain in place. `npm run watch` updates
readable UI HTML/JS and CSS during development. Stop watch before production builds.
`npm run clear` removes generated UI/CSS and background/content/store scripts,
preserving source files and assets. Runtime code is dependency-free; extension-page
styles are compiled with Tailwind into `main.css`.

Run focused regression tests with Node's built-in runner:

```sh
node --test tests/*.test.mjs
```

There is no linter, CI, or custom build validation. Verify browser behavior by
loading `extension/` and exercising affected surfaces after reloading it.

## Axion Digital

Explore more work and get in touch at **[axiondigital.co](https://axiondigital.co/)**
