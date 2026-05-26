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
    if (file.endsWith('.js.map')) {
      return;
    }
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (path.extname(file) === '.js') {
      const mjsPath = fullPath.replace(/\.js$/, '.mjs');
      const jsMapPath = `${fullPath}.map`;
      const mjsMapPath = `${mjsPath}.map`;
      fs.renameSync(fullPath, mjsPath);
      if (fs.existsSync(jsMapPath)) {
        const map = JSON.parse(fs.readFileSync(jsMapPath, 'utf8'));
        map.file = path.basename(mjsPath);
        fs.writeFileSync(mjsMapPath, JSON.stringify(map), 'utf8');
        fs.unlinkSync(jsMapPath);
      }
      const mjsContent = fs.readFileSync(mjsPath, 'utf8');
      fs.writeFileSync(
        mjsPath,
        mjsContent.replace(/\/\/\# sourceMappingURL=.*$/m, `//# sourceMappingURL=${path.basename(mjsMapPath)}`),
        'utf8'
      );
      
      // Copy to dist with .mjs extension
      const relativePath = path.relative(distEsmDir, mjsPath);
      const targetPath = path.join(distDir, relativePath);
      const targetDir = path.dirname(targetPath);
      
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      fs.copyFileSync(mjsPath, targetPath);
      if (fs.existsSync(mjsMapPath)) {
        fs.copyFileSync(mjsMapPath, `${targetPath}.map`);
      }
    }
  });
}

if (fs.existsSync(distEsmDir)) {
  processDirectory(distEsmDir);
  console.log('✓ ESM build complete');
}
