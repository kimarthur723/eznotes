#!/bin/bash

echo "======================================"
echo "   EZ Notes Environment Check"
echo "======================================"
echo ""

# Check Node version
echo "📦 Node.js"
NODE_VERSION=$(node -v 2>/dev/null || echo "NOT INSTALLED")
echo "   Version: $NODE_VERSION"
if [[ "$NODE_VERSION" != "NOT INSTALLED" ]]; then
    REQUIRED="20.9.0"
    CURRENT="${NODE_VERSION#v}"
    if [ "$(printf '%s\n' "$REQUIRED" "$CURRENT" | sort -V | head -n1)" = "$REQUIRED" ] && [ "$CURRENT" != "$REQUIRED" ]; then
        echo "   Status: ✅ PASS (>= 20.9.0)"
    else
        echo "   Status: ❌ FAIL (need >= 20.9.0)"
    fi
else
    echo "   Status: ❌ FAIL (not installed)"
fi
echo ""

# Check npm
echo "📦 npm"
NPM_VERSION=$(npm -v 2>/dev/null || echo "NOT INSTALLED")
echo "   Version: $NPM_VERSION"
if [[ "$NPM_VERSION" != "NOT INSTALLED" ]]; then
    echo "   Status: ✅ PASS"
else
    echo "   Status: ❌ FAIL (not installed)"
fi
echo ""

# Check paths
echo "📂 Environment Paths"
echo "   Current directory: $(pwd)"
echo "   Node location: $(which node 2>/dev/null || echo "NOT FOUND")"
echo "   npm location: $(which npm 2>/dev/null || echo "NOT FOUND")"
echo ""

# Check if paths are in WSL
NODE_PATH=$(which node 2>/dev/null || echo "")
if [[ "$NODE_PATH" == /home/* ]] || [[ "$NODE_PATH" == /usr/* ]]; then
    echo "   Status: ✅ PASS (running in WSL)"
elif [[ "$NODE_PATH" == /mnt/* ]]; then
    echo "   Status: ⚠️  WARNING (using Windows Node via /mnt)"
elif [[ "$NODE_PATH" == *wsl* ]] || [[ "$NODE_PATH" == *Windows* ]]; then
    echo "   Status: ❌ FAIL (UNC path detected)"
else
    echo "   Status: ❓ UNKNOWN"
fi
echo ""

# Check for dependencies
echo "📚 Dependencies"
if [ -d "node_modules" ]; then
    echo "   node_modules: ✅ EXISTS"
    if [ -d "node_modules/next" ]; then
        echo "   Next.js: ✅ INSTALLED"
    else
        echo "   Next.js: ❌ NOT FOUND"
    fi
    if [ -d "node_modules/react" ]; then
        echo "   React: ✅ INSTALLED"
    else
        echo "   React: ❌ NOT FOUND"
    fi
else
    echo "   node_modules: ❌ NOT FOUND (run npm install)"
fi
echo ""

# Check for .env
echo "⚙️  Configuration"
if [ -f ".env" ]; then
    echo "   .env file: ✅ EXISTS"
else
    echo "   .env file: ❌ NOT FOUND (copy from .env.example)"
fi
echo ""

# Summary
echo "======================================"
echo "   Summary"
echo "======================================"
echo ""
if [[ "$NODE_VERSION" == "NOT INSTALLED" ]]; then
    echo "❌ BLOCKED: Node.js not installed"
    echo "   → Install Node.js >= 20.9.0"
elif [ "$(printf '%s\n' "20.9.0" "${NODE_VERSION#v}" | sort -V | head -n1)" != "20.9.0" ]; then
    echo "❌ BLOCKED: Node.js version too old"
    echo "   → Upgrade to >= 20.9.0 using nvm"
elif [[ "$NODE_PATH" == *wsl* ]] || [[ "$NODE_PATH" == *Windows* ]]; then
    echo "❌ BLOCKED: WSL path issue"
    echo "   → Reinstall Node in WSL (see FIX_BLOCKING_ISSUES.md)"
elif [ ! -d "node_modules" ]; then
    echo "⚠️  INCOMPLETE: Dependencies not installed"
    echo "   → Run: npm install"
else
    echo "✅ READY: Environment looks good!"
    echo "   → Run: npm run dev"
fi
echo ""
echo "For detailed fixes, read: FIX_BLOCKING_ISSUES.md"
echo ""
