# QR Generator

Instant QR code generator for text and URLs. Runs entirely in the browser — nothing is uploaded.

**Features**
- Live preview that updates as you type
- Error correction levels L / M / Q / H
- Links get the site's favicon in the centre, sized to what the error correction level can absorb (looked up via [icon.horse](https://icon.horse); only the domain is sent)
- Dots (default) or square modules
- Custom foreground and background colors
- Download as PNG (up to 4096px) or vector SVG, or copy to clipboard

**Stack:** plain HTML, CSS, and JavaScript. QR encoding via [qrcode-generator](https://cdnjs.com/libraries/qrcode-generator) (CDN), custom canvas/SVG rendering.

## Run locally

Open `index.html` in a browser. That's it — no build step.

## Deploy to GitHub Pages

1. Push these files to a repo
2. Settings → Pages → Source: `main` branch, `/ (root)`
3. Live at `https://<username>.github.io/<repo>/`
