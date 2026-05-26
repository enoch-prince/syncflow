const fs = require('fs');
const path = require('path');

const fs = require('fs');
const path = require('path');

const targetDir = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.join(__dirname, '..');
const pkgPath = path.join(targetDir, 'package.json');
const outPath = path.join(targetDir, 'src', 'version.ts');

function main() {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  // Prefer npm-provided version (set during npm lifecycle) if available
  const version = process.env.npm_package_version || pkg.version;
  const content = `// Generated file — do not edit\nexport const VERSION = '${version}';\n`;
  fs.writeFileSync(outPath, content, 'utf8');
  console.log(`Wrote ${outPath}`);
}

main();
