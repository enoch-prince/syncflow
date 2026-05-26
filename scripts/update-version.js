const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'package.json');
const outPath = path.join(__dirname, '..', 'src', 'version.ts');

function main() {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const content = `// Generated file — do not edit\nexport const VERSION = '${pkg.version}';\n`;
  fs.writeFileSync(outPath, content, 'utf8');
  console.log(`Wrote ${outPath}`);
}

main();
