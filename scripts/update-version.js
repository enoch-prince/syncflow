const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '..', 'package.json');
const outPath = path.join(__dirname, '..', 'src', 'version.ts');

function main() {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  // Prefer npm-provided version (set during npm lifecycle) if available
  const version = process.env.npm_package_version || pkg.version;
  const content = `// Generated file — do not edit\nexport const VERSION = '${version}';\n`;
  fs.writeFileSync(outPath, content, 'utf8');
  console.log(`Wrote ${outPath}`);
}

main();
