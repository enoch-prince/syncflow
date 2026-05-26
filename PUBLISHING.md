# Publishing SyncFlow to NPM

## 🚀 Quick Publish

```bash
# 1. Update package info
#    Edit package.json: name, author, repository

# 2. Build the package
npm run build

# 3. Test locally
npm pack
npm install ./syncflow-core-1.0.0.tgz

# 4. Login to NPM
npm login

# 5. Publish
npm publish --access public
```

## 📋 Pre-Publish Checklist

- [ ] Update `package.json` with your details
- [ ] Replace placeholder names/emails
- [ ] Update repository URLs
- [ ] Test build: `npm run build`
- [ ] Check `dist/` folder exists
- [ ] Verify types: `dist/index.d.ts`
- [ ] Test import: `node -e "require('./dist/index.js')"`
- [ ] Update CHANGELOG.md
- [ ] Commit all changes
- [ ] Create git tag: `git tag v1.0.0`

## 📝 Required Updates

### 1. package.json

```json
{
  "name": "@your-username/syncflow",  // Change this
  "author": "Your Name <you@example.com>",  // Change this
  "repository": {
    "url": "https://github.com/your-username/syncflow.git"  // Change this
  }
}
```

### 2. README.md

Update badges and links:
```markdown
[![npm version](https://img.shields.io/npm/v/@your-username/syncflow.svg)]
```

## 🔑 NPM Account Setup

### First Time

```bash
# Create account at npmjs.com
# Or via CLI:
npm adduser

# Verify login
npm whoami
```

### Two-Factor Authentication (Recommended)

```bash
# Enable 2FA
npm profile enable-2fa auth-and-writes

# Generate token for CI/CD
npm token create --read-only
```

## 📦 Publishing Process

### Version Bump

```bash
# Patch (1.0.0 -> 1.0.1)
npm version patch

# Minor (1.0.0 -> 1.1.0)
npm version minor

# Major (1.0.0 -> 2.0.0)
npm version major
```

### Build & Publish

```bash
# Clean build
npm run clean
npm run build

# Verify package contents
npm pack --dry-run

# Publish
npm publish --access public
```

### Tags

```bash
# Latest (default)
npm publish --tag latest

# Beta release
npm publish --tag beta

# Next version
npm publish --tag next
```

## 🎯 Package Scopes

### Scoped Package (Recommended)

```json
{
  "name": "@your-username/syncflow"
}
```

**Publish:**
```bash
npm publish --access public
```

### Unscoped Package

```json
{
  "name": "syncflow"  // Must be unique globally!
}
```

**Check availability:**
```bash
npm view syncflow
# If returns 404, it's available
```

## 🔄 Update Workflow

```bash
# 1. Make changes
# 2. Update CHANGELOG.md
# 3. Bump version
npm version patch

# 4. Build
npm run build

# 5. Publish
npm publish --access public

# 6. Push to git
git push && git push --tags
```

## 🧪 Testing Before Publish

### Local Test

```bash
# Pack
npm pack

# Install in test project
cd ../test-project
npm install ../syncflow/syncflow-core-1.0.0.tgz

# Test import
node -e "const sf = require('@syncflow/core'); console.log(sf)"
```

### Link Test

```bash
# In syncflow/
npm link

# In test project
npm link @syncflow/core

# Test
import { createDatabase } from '@syncflow/core';
```

## 📊 What Gets Published

### Included (from `files` in package.json)

```
✅ dist/           - Compiled code
✅ README.md       - Documentation
✅ LICENSE         - License
✅ CHANGELOG.md    - Version history
✅ package.json    - Package metadata
```

### Excluded (from `.npmignore`)

```
❌ src/            - Source TypeScript
❌ server/         - Server source
❌ node_modules/   - Dependencies
❌ .git/           - Git history
❌ tests/          - Test files
```

## 🔐 Publishing to GitHub Packages

Alternative to npmjs.com:

```bash
# 1. Create .npmrc
echo "@your-username:registry=https://npm.pkg.github.com" > .npmrc

# 2. Login
npm login --registry=https://npm.pkg.github.com

# 3. Update package.json
{
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}

# 4. Publish
npm publish
```

## 🤖 Automated Publishing (GitHub Actions)

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to NPM

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      
      - run: npm ci
      - run: npm run build
      - run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## 🐛 Troubleshooting

### "Package already exists"

```bash
# Check if name is taken
npm view @your-username/syncflow

# Try different name or scope
```

### "Permission denied"

```bash
# Verify login
npm whoami

# Check package ownership
npm owner ls @your-username/syncflow
```

### "Build failed"

```bash
# Clean and rebuild
rm -rf dist dist-esm node_modules
npm install
npm run build
```

### "Types not generated"

```bash
# Check tsconfig.json has:
{
  "declaration": true,
  "emitDeclarationOnly": true
}

# Rebuild
npm run build:types
```

## 📈 Post-Publish

### Verify Installation

```bash
# Install from npm
npm install @your-username/syncflow

# Check version
npm view @your-username/syncflow version

# View package page
open https://www.npmjs.com/package/@your-username/syncflow
```

### Update Documentation

- [ ] Update README badges
- [ ] Add to GitHub releases
- [ ] Tweet announcement
- [ ] Update website
- [ ] Write blog post

## 🎉 You're Published!

Users can now install:

```bash
npm install @your-username/syncflow
```

```typescript
import { createDatabase } from '@your-username/syncflow';
```

## 📞 Support

Having issues? Check:
- [NPM Docs](https://docs.npmjs.com/)
- [Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Scoped Packages](https://docs.npmjs.com/cli/v8/using-npm/scope)

---

**Ready to publish? Run:** `npm publish --access public`
