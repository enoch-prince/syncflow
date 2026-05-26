# 🚀 Publishing SyncFlow to NPM - Quick Guide

## ✅ Pre-Publishing Checklist

- [ ] Update version in `package.json`
- [ ] Update `CHANGELOG.md` with changes
- [ ] Run `npm run build` successfully
- [ ] Run `npm test` successfully
- [ ] Update README if needed
- [ ] Commit all changes to git
- [ ] Create git tag for version

## 📦 Step 1: Build the Package

```bash
# Clean previous builds
npm run clean

# Build everything
npm run build

# This creates:
# - dist/*.js (CommonJS)
# - dist/*.mjs (ESM)
# - dist/*.d.ts (TypeScript definitions)
```

## 🧪 Step 2: Test Locally

```bash
# Create a tarball
npm pack

# This creates: syncflow-core-1.0.0.tgz

# Test in another project
cd ../test-project
npm install ../syncflow/syncflow-core-1.0.0.tgz

# Verify it works
import { createDatabase } from '@syncflow/core';
```

## 🔐 Step 3: Login to NPM

```bash
# Login (first time only)
npm login

# Verify you're logged in
npm whoami
```

## 📤 Step 4: Publish to NPM

```bash
# Dry run (see what will be published)
npm publish --dry-run

# Publish for real
npm publish --access public

# ✨ Published to: https://www.npmjs.com/package/@syncflow/core
```

## 🎉 Step 5: Verify

```bash
# Check it's live
npm view @syncflow/core

# Install in a test project
npm install @syncflow/core

# Test it works!
```

## 🔄 Updating Versions

```bash
# Patch version (1.0.0 → 1.0.1)
npm version patch
npm publish --access public

# Minor version (1.0.0 → 1.1.0)
npm version minor
npm publish --access public

# Major version (1.0.0 → 2.0.0)
npm version major
npm publish --access public
```

## 📋 What Gets Published?

Only these files (from `package.json` → `files`):

```
✅ dist/           - Compiled code
✅ README.md       - Documentation
✅ LICENSE         - Legal
✅ CHANGELOG.md    - Version history
✅ package.json    - Package metadata
```

**NOT published:**
```
❌ src/            - Source code
❌ server/         - Server code (source)
❌ tests/          - Test files
❌ examples/       - Example code
❌ node_modules/   - Dependencies
❌ .git/           - Git history
```

## 🏷️ Package Scopes

Your package is scoped: `@syncflow/core`

**Benefits:**
- ✅ Namespace protection
- ✅ Related packages: `@syncflow/react`, `@syncflow/vue`
- ✅ Free for public packages
- ✅ Professional appearance

## 🌍 Using Your Published Package

```bash
# Install
npm install @syncflow/core wa-sqlite

# Use in code
import { createDatabase } from '@syncflow/core';

const { db } = await createDatabase({
  name: 'my-app',
  serverUrl: 'http://localhost:3000'
});
```

## 🔧 Troubleshooting

### "Package name already taken"
```bash
# Use a different scope
"name": "@yourusername/syncflow"

# Or different name
"name": "@syncflow/db"
```

### "You must be logged in"
```bash
npm login
npm whoami  # Verify
```

### "403 Forbidden"
```bash
# Make sure package is public
npm publish --access public
```

### Build errors
```bash
# Clean and rebuild
npm run clean
rm -rf node_modules
npm install
npm run build
```

## 📊 After Publishing

### Update Documentation
- [ ] Add installation instructions to README
- [ ] Update website (if you have one)
- [ ] Share on Twitter/LinkedIn
- [ ] Post on Reddit (r/javascript, r/typescript)
- [ ] Add to awesome-lists

### Monitor
- [ ] Check download stats: https://npm-stat.com
- [ ] Watch GitHub issues
- [ ] Respond to questions

## 🎯 Quick Commands Reference

```bash
# Build
npm run build

# Test
npm test

# Version bump
npm version patch|minor|major

# Publish
npm publish --access public

# Check package
npm view @syncflow/core

# Unpublish (within 72 hours)
npm unpublish @syncflow/core@1.0.0 --force
```

## 🚀 You're Ready!

Run these commands to publish:

```bash
# 1. Build
npm run build

# 2. Test
npm test

# 3. Login
npm login

# 4. Publish
npm publish --access public
```

That's it! Your package is live! 🎉

Visit: https://www.npmjs.com/package/@syncflow/core
