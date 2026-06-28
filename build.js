// build.js — concatenate logic + UI into a single self-contained index.html. No deps.
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');

const logic = ['src/data.js','src/engine.js','src/standings.js','src/draw.js','src/persist.js']
  .map(read).join('\n\n');
const ui = read('src/ui.jsx');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>MSI 2026 — Stage 2 Bracket Simulator</title>
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone@7/babel.min.js"></script>
<style id="appstyle">__CSS__</style>
</head>
<body>
<div id="root">Loading… (this page needs an internet connection on first load for React)</div>
<script>
${logic}
</script>
<script type="text/babel" data-presets="react">
${ui}
</script>
</body>
</html>`;

const css = read('src/styles.css');
fs.writeFileSync(path.join(__dirname, 'index.html'), html.replace('__CSS__', css));
console.log('Wrote index.html (' + html.length + ' bytes)');
