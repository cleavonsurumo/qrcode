# QR Generator

Instant QR code generator for text and URLs. Runs entirely in the browser — nothing is uploaded.

**Features**
- Live preview that updates as you type
- Error correction levels L / M / Q / H
- Links get the site's favicon in the centre, sized to what the error correction level can absorb (looked up via [icon.horse](https://icon.horse); only the domain is sent)
- Dots (default) or square modules
- Custom foreground and background colors
- Download as PNG (up to 4096px) or vector SVG, or copy to clipboard

## File transfer over QR (Send / Receive)

The **Send** and **Receive** modes move a file or text between two devices as an animated QR stream, screen to camera, with no network between them. Pick Send on one device and Receive on the other. `#send` and `#receive` link straight to a mode.

They are [Decimen Optical Transfer](https://github.com/bashalarmistalt/decimen-optical-transfer) v0.5.3, embedded from [`decimen/`](decimen/) by [`transfer.js`](transfer.js) and restyled to match this page by [`decimen/theme.css`](decimen/theme.css). Decimen is © Evan Crawley and contributors, licensed **AGPL-3.0-or-later**; the edits made to it are listed in [`decimen/CHANGES.txt`](decimen/CHANGES.txt), which its footer links to.

To update Decimen, download the sender and receiver HTML files from a newer [release](https://github.com/bashalarmistalt/decimen-optical-transfer/releases) and run `node decimen/patch.js <sender.html> <receiver.html>`. Also update the version in `CHANGES.txt` and the licence files.

**Stack:** plain HTML, CSS, and JavaScript. QR encoding via [qrcode-generator](https://cdnjs.com/libraries/qrcode-generator) (CDN), custom canvas/SVG rendering.

## Run locally

Open `index.html` in a browser. That's it — no build step.

Send and Receive need the page served over `http://localhost` (for example `npx serve .`), not opened from disk: browsers lock down frames and the camera on `file://` pages.

## Deploy to GitHub Pages

1. Push these files to a repo
2. Settings → Pages → Source: `main` branch, `/ (root)`
3. Live at `https://<username>.github.io/<repo>/`
