// Applies this site's edits to a Decimen Optical Transfer release and writes
// decimen/send.html and decimen/receive.html. CHANGES.txt lists the edits.
//
//   node decimen/patch.js <decimen-vX-sender.html> <decimen-vX-receiver.html>
//
// Each edit is an exact-match replacement that must hit exactly once, so a
// release whose markup has moved fails loudly instead of shipping half-patched.

const fs = require('fs');
const path = require('path');

const RECEIVER_URL = 'https://qrcode.cleavon.ke/#receive';

const COMMON = [
  {
    label: 'modification notice',
    from: 'Source: https://github.com/bashalarmistalt/decimen-optical-transfer -->',
    to: 'Source: https://github.com/bashalarmistalt/decimen-optical-transfer -->\n' +
        '<!-- Modified for qrcode.cleavon.ke: restyled by theme.css. See CHANGES.txt in this folder. -->',
  },
  {
    // Lets theme.css and the Poppins font load. connect-src is left alone, so
    // the pages still cannot send data anywhere.
    label: 'content security policy',
    from: 'style-src &#39;unsafe-inline&#39;; font-src &#39;none&#39;;',
    to: 'style-src &#39;unsafe-inline&#39; &#39;self&#39; https://fonts.googleapis.com; font-src https://fonts.gstatic.com;',
  },
  {
    label: 'theme stylesheet',
    from: '</head>',
    to: '<link rel="preconnect" href="https://fonts.googleapis.com" />\n' +
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n' +
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;700&display=swap" />\n' +
        '<link rel="stylesheet" href="theme.css" />\n</head>',
  },
  {
    label: 'footer changes link',
    from: '>AGPL-3.0-or-later</a></span>',
    to: '>AGPL-3.0-or-later</a> · <a href="CHANGES.txt">modified for this site</a></span>',
  },
];

const SENDER_ONLY = [
  {
    label: 'share-the-receiver link',
    from: 'value="https://decimen.app/receive/"',
    to: 'value="' + RECEIVER_URL + '"',
  },
  {
    // 60 fps outran the Android phone cameras this site was tested with; 24 is
    // the rate Decimen's own "Nothing happening?" tips fall back to.
    label: 'default tx fps',
    from: '<option>24</option><option>30</option><option>55</option><option selected>60</option>',
    to: '<option selected>24</option><option>30</option><option>55</option><option>60</option>',
  },
];

function replaceOnce(html, edit, file) {
  const at = html.indexOf(edit.from);
  if (at === -1 || html.indexOf(edit.from, at + 1) !== -1) {
    throw new Error(path.basename(file) + ': "' + edit.label + '" must match exactly once: ' + edit.from);
  }
  return html.slice(0, at) + edit.to + html.slice(at + edit.from.length);
}

function patch(src, dest, edits) {
  let html = fs.readFileSync(src, 'utf8');
  for (const edit of edits) html = replaceOnce(html, edit, src);
  fs.writeFileSync(dest, html);
  console.log('wrote ' + path.relative(process.cwd(), dest));
}

const [sender, receiver] = process.argv.slice(2);
if (!sender || !receiver) {
  console.error('usage: node decimen/patch.js <sender.html> <receiver.html>');
  process.exit(1);
}
patch(sender, path.join(__dirname, 'send.html'), COMMON.concat(SENDER_ONLY));
patch(receiver, path.join(__dirname, 'receive.html'), COMMON);
