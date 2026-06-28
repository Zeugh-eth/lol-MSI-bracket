// build.js — concatenate logic + UI into a single self-contained index.html. No deps.
const fs = require('fs');
const path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');

const logic = ['src/data.js','src/engine.js','src/standings.js','src/draw.js','src/persist.js','src/h2h.js']
  .map(read).join('\n\n');
const ui = read('src/ui.jsx');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>MSI is NOW — 2026 Stage 2 Bracket</title>
<meta name="description" content="Check the teams, discover the brackets. A fan-made simulator for MSI 2026 Stage 2 — draw the seeding, enter results, and see how the double-elimination bracket plays out." />
<link rel="canonical" href="https://msibracket.xyz/" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="MSI 2026 Bracket" />
<meta property="og:title" content="MSI is NOW" />
<meta property="og:description" content="Check the teams, discover the brackets." />
<meta property="og:url" content="https://msibracket.xyz/" />
<meta property="og:image" content="https://msibracket.xyz/og.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="MSI is NOW — Stage 2 double-elimination bracket" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="MSI is NOW" />
<meta name="twitter:description" content="Check the teams, discover the brackets." />
<meta name="twitter:image" content="https://msibracket.xyz/og.png" />
<meta name="theme-color" content="#E8462E" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;600;700;800&display=swap" rel="stylesheet" />
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
const outPath = path.join(__dirname, 'index.html');
const outContent = html.replace('__CSS__', css) + '\n';
fs.writeFileSync(outPath, outContent);
console.log('Wrote index.html (' + outContent.length + ' bytes)');
