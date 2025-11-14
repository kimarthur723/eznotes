# Fixing Blocking Issues

You have **two critical issues** preventing the app from running. Both need to be fixed before you can proceed.

---

## Issue 1: WSL Path Problem (UNC paths not supported)

### Problem
npm is invoking Windows CMD instead of running in WSL, causing "UNC paths are not supported" errors.

### Solution Options

**Option A: Fix npm in WSL (Recommended)**

1. Make sure you're in a proper WSL terminal (not Windows Command Prompt or PowerShell)
2. Check your current path:
   ```bash
   pwd
   # Should show: /home/rthur/eznotes
   # NOT: \\wsl.localhost\Ubuntu\home\rthur\eznotes
   ```

3. If the path looks wrong, you might have a corrupted npm installation. Reinstall Node.js in WSL:
   ```bash
   # Remove current Node
   sudo apt remove nodejs npm

   # Install nvm (Node Version Manager)
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

   # Restart terminal or source profile
   source ~/.bashrc

   # Install Node 20.9.0 or higher
   nvm install 20.9.0
   nvm use 20.9.0
   nvm alias default 20.9.0

   # Verify
   node -v  # Should show v20.9.0 or higher
   which node  # Should show path in /home/.../.nvm/...
   ```

**Option B: Run from Different Terminal**

If you're using Windows Terminal or VS Code terminal, try:
1. Open pure WSL Ubuntu terminal (from Windows Start menu)
2. Navigate to project:
   ```bash
   cd ~/eznotes
   pwd  # Verify path looks correct
   ```
3. Try npm commands again

**Option C: Use WSL 2 with proper mounting**

Check your WSL version:
```bash
wsl --list --verbose
```

If you're on WSL 1, upgrade to WSL 2:
```powershell
# In PowerShell (as admin)
wsl --set-version Ubuntu 2
```

---

## Issue 2: Node.js Version Too Old

### Problem
- Current: Node.js 20.0.0
- Required: >= 20.9.0

### Solution

After fixing the WSL issue above (which reinstalls Node), verify:
```bash
node -v  # Should show >= v20.9.0
```

If you still need to upgrade:
```bash
# Using nvm (recommended)
nvm install 20.9.0
nvm use 20.9.0
nvm alias default 20.9.0

# Or install latest LTS
nvm install --lts
nvm use --lts
```

---

## After Fixing Both Issues

Once you have:
- ✅ Node.js >= 20.9.0
- ✅ npm working properly in WSL (no UNC path errors)

Run these commands:

```bash
# 1. Install dependencies (should work now)
npm install

# 2. Install additional packages
npm install prisma @prisma/client @deepgram/sdk openai

# 3. Generate Prisma client
npx prisma generate

# 4. Create database
npx prisma db push

# 5. Start dev server
npm run dev
```

The app should now be accessible at http://localhost:3000

---

## Verify Everything Works

```bash
# Check Node version
node -v  # Should be >= 20.9.0

# Check npm is running in WSL
which npm  # Should show path in /home/...

# Check dependencies
npm list next prisma react  # Should show installed versions

# Run dev server
npm run dev  # Should start without errors
```

---

## Quick Test Script

Run this to verify your environment:

```bash
#!/bin/bash
echo "=== Environment Check ==="
echo "Node version: $(node -v)"
echo "npm version: $(npm -v)"
echo "Current directory: $(pwd)"
echo "npm location: $(which npm)"
echo "node location: $(which node)"
echo ""
echo "Expected:"
echo "- Node >= v20.9.0"
echo "- Paths should be in /home/... (not \\\\wsl...)"
```

Save as `check-env.sh`, run with `bash check-env.sh`

---

## Alternative: Use Docker (If WSL issues persist)

If you can't fix the WSL issues, use Docker instead:

1. Create `Dockerfile`:
```dockerfile
FROM node:20.9-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "run", "dev"]
```

2. Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
```

3. Run:
```bash
docker-compose up
```

---

## Still Having Issues?

If problems persist, check:
1. Windows Defender or antivirus blocking npm
2. Corporate proxy or firewall
3. Disk permissions on WSL filesystem
4. Try creating project in different location: `/tmp/eznotes`

## Summary

**You must fix these in order:**
1. Fix WSL/npm setup (use Option A above)
2. Upgrade Node.js to >= 20.9.0
3. Then install dependencies and run the app

The code is ready to run once your environment is fixed!
