#!/usr/bin/env node

/**
 * ESM Wrapper Script
 * 
 * Converts CJS output to ESM with .mjs extensions
 * Enables dual package support (CJS + ESM)
 */

const fs = require('fs');
const path = require('path');

const distEsmDir = path.join(__dirname, '..', 'dist-esm');
const distDir = path.join(__dirname, '..', 'dist');

function copyWithExtension(src, dest, ext) {
  if (!fs.existsSync(src)) {
    console.warn(`Source directory does not exist: ${src}`);
    return;
  }

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const files = fs.readdirSync(src);

  files.forEach(file => {
    const srcPath = path.join(src, file);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      const destPath = path.join(dest, file);
      copyWithExtension(srcPath, destPath, ext);
    } else if (file.endsWith('.js')) {
      const newFileName = file.replace('.js', ext);
      const destPath = path.join(dest, newFileName);
      
      let content = fs.readFileSync(srcPath, 'utf8');
      
      // Fix relative imports to use .mjs extension
      content = content.replace(/require\(['"](\.[^'"]+)['"]\)/g, (match, p1) => {
        if (!p1.endsWith('.json')) {
          return `require('${p1}.mjs')`;
        }
        return match;
      });

      // Convert require to import for ESM
      content = content.replace(/const\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\)/g, 
        'import $1 from \'$2\'');
      
      content = content.replace(/exports\./g, 'export ');
      content = content.replace(/module\.exports\s*=\s*/g, 'export default ');

      fs.writeFileSync(destPath, content);
      console.log(`Created: ${destPath}`);
    } else {
      // Copy non-JS files as-is
      const destPath = path.join(dest, file);
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

console.log('Creating ESM build...');
copyWithExtension(distEsmDir, distDir, '.mjs');
console.log('✓ ESM build complete');

// Cleanup
if (fs.existsSync(distEsmDir)) {
  fs.rmSync(distEsmDir, { recursive: true });
  console.log('✓ Cleaned up intermediate files');
}
