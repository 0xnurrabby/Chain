
# NurChain — Windows Install Guide

## Quick Setup (Windows)
1. Open **PowerShell** (no need for Administrator).
2. From the project root run installs separately to avoid Windows EPERM during nested postinstall:

```
npm --prefix server install
npm --prefix client install
```

3. Start dev:
```
npm run dev
```

## If you see `EPERM: operation not permitted, rmdir` during install
This is a Windows file-handle/antivirus quirk when one process has a lock on a folder inside `node_modules`.

**Fixes:**
- Make sure no editor/terminal is open *inside* `server/node_modules` or `client/node_modules`.
- Close antivirus real-time scanning during installation (optional).
- Clear cache and reinstall:
  ```
  npm cache clean --force
  rmdir /s /q server\node_modules
  rmdir /s /q client\node_modules
  npm --prefix server install
  npm --prefix client install
  ```

## Requirements
- Node.js 18+
- Ports 3001 and 5173 available
