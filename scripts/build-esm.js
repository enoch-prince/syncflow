/**
 * Convert CJS build to ESM format
 * Renames .js to .mjs and updates imports
 */

const fs = require('fs');
const path = require('path');

const distEsmDir = path.join(__dirname, '..', 'dist-esm');
const distDir = path.join(__dirname, '..', 'dist');

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (file.endsWith('.js')) {
      const mjsPath = fullPath.replace(/\.js$/, '.mjs');
      fs.renameSync(fullPath, mjsPath);
      
      // Copy to dist with .mjs extension
      const relativePath = path.relative(distEsmDir, mjsPath);
      const targetPath = path.join(distDir, relativePath);
      const targetDir = path.dirname(targetPath);
      
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      fs.copyFileSync(mjsPath, targetPath);
    }
  });
}

if (fs.existsSync(distEsmDir)) {
  processDirectory(distEsmDir);
  console.log('✓ ESM build complete');
}
