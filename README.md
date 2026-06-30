# Civic Bryn Pixel — Google Tag Manager template

Official [Google Tag Manager](https://tagmanager.google.com/) custom tag template
for the **Civic Bryn Pixel**. Adding it to a GTM container lets a site send a
privacy-conscious page-view signal to Civic Bryn — no code changes to the website
itself.

## What it does

When the tag fires, it:

1. Publishes your **Civic Bryn Pixel reference** to a first-party config global
   (`window.__brynPixel`).
2. Loads the official Civic Bryn pixel from
   `https://bryn.civic.com/pixel/pixel.js`.

The pixel then runs in the page (outside the GTM sandbox) and:

- **Posts a page-view beacon** — the page URL, the referrer, and a timestamp — to
  the Civic Bryn ingest endpoint.
- **Upgrades personalization slots in-session** — if the page contains Civic Bryn
  personalization markup (`[data-bryn-slot]` / `[data-bryn-field]`), the pixel
  fills it with personalized content once Civic Bryn resolves the visitor. Pages
  without that markup simply skip this step.

## What it sends

Only three fields, as a JSON `POST`:

| Field      | Example                          | Notes                              |
| ---------- | -------------------------------- | ---------------------------------- |
| `url`      | `https://example.com/pricing`    | The current page URL.              |
| `referrer` | `https://google.com/`            | `document.referrer`.               |
| `ts`       | `1751299200000`                  | Client timestamp, ms since epoch.  |

It does **not** read cookies, form fields, or any personal data from the page.

## Installation

1. In GTM, open **Templates → Tag Templates → Search Gallery** and add
   **Civic Bryn Pixel**. (Until it is published to the gallery, import
   `template.tpl` via **Templates → New → Import**.)
2. Create a new tag using the template.
3. Enter your **Civic Bryn Pixel reference** (from the Civic Bryn console).
4. Set the trigger to **All Pages** (or whichever pages you want to track).
5. **Submit** and publish the container.

### Advanced

- **Endpoint override** — leave blank to use the default Civic Bryn ingest
  endpoint. Set it only if Civic Bryn has given you a custom endpoint base URL.

## Permissions

The template requests only what it needs:

| Permission       | Scope                       | Why                                            |
| ---------------- | --------------------------- | ---------------------------------------------- |
| `inject_script`  | `https://bryn.civic.com/*`  | Load the official Civic Bryn pixel.            |
| `access_globals` | write `__brynPixel`         | Pass your Pixel reference to the pixel.        |

## Using a Content Security Policy?

If your site sends a strict `Content-Security-Policy`, the browser will block the
pixel until you allowlist the Civic Bryn origin in **two** directives:

| Directive     | Add                        | Why                                                   |
| ------------- | -------------------------- | ----------------------------------------------------- |
| `script-src`  | `https://bryn.civic.com`   | Lets the page load `pixel.js`.                        |
| `connect-src` | `https://bryn.civic.com`   | Lets the pixel send its beacon and fetch personalization. |

This is the same one-host allowlist that other tag-based pixels (Meta, LinkedIn,
TikTok) require. Installing via GTM avoids touching your site's markup, but the
pixel still runs under your page's CSP — so a strict-CSP site must still make this
one change. Sites without a CSP need no action.

## Privacy

The Civic Bryn pixel sends only the page URL, referrer, and timestamp. See the
[Civic privacy policy](https://www.civic.com/legal/privacy-policy) for how Civic
handles this data.

## Support

Open an issue on this repository, or contact Civic Bryn support through the Civic
Bryn console.

## License

[Apache 2.0](./LICENSE)
