<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=2,8,15&height=180&section=header&text=NurChain&fontSize=52&fontColor=000000&fontAlignY=38&desc=Full-stack+blockchain+data+explorer+with+React+frontend+and+Node+backend&descAlignY=58&descSize=14&animation=fadeIn" width="100%"/>

<div align="center">

[![License](https://img.shields.io/badge/MIT-bbf7d0?style=for-the-badge&logoColor=000)](LICENSE)
[![Platform](https://img.shields.io/badge/Node.js%2018%2B-bfdbfe?style=for-the-badge&logoColor=000)]()
[![Tech](https://img.shields.io/badge/React%20%2B%20TypeScript-fde68a?style=for-the-badge&logoColor=000)]()

</div>

<div align="center">
<i>A full-stack blockchain explorer app with a TypeScript Express backend and a React + Vite frontend for browsing on-chain data.</i>
</div>

---

## ✦ Features

<div align="center">

| | Feature | What it does |
|:---:|---|---|
| 🔍 | Blockchain explorer | Browse blocks, transactions, and addresses |
| ⚡ | Real-time data | Connects to live blockchain RPC for up-to-date results |
| 🖥️ | Full-stack | Separate client and server with clean API boundary |
| 📱 | Responsive UI | React + Tailwind UI works on desktop and mobile |

</div>

---

## ✦ Download & Run

**Step 1** .... Clone the repo

```bash
git clone https://github.com/0xnurrabby/Chain
cd Chain
```

**Step 2** .... Install dependencies (Windows-safe approach)

```bash
# Install server and client separately to avoid Windows EPERM errors
npm --prefix server install
npm --prefix client install
```

**Step 3** .... Start dev servers

```bash
npm run dev
# This starts both server (port 3001) and client (port 5173) together
```

---

## ✦ Setup

```
1. Clone the repo
2. Install dependencies separately:
   npm --prefix server install
   npm --prefix client install
3. If you get EPERM errors on Windows:
   - Close any editors or terminals pointing inside node_modules
   - Run: npm cache clean --force
   - Delete server\node_modules and client\node_modules
   - Re-run the installs above
4. Run npm run dev to start both processes
5. Open http://localhost:5173 in your browser
6. Server API runs on http://localhost:3001
Requirements: Node.js 18+, ports 3001 and 5173 available
```

---

## ✦ Project Structure

```
Chain/
  server/
    src/
      index.ts       ->  Express server entry point
      blockchain.ts  ->  RPC calls and block/tx fetching logic
      types.ts       ->  TypeScript type definitions
      utils.ts       ->  helper functions
    package.json
    tsconfig.json
  client/
    src/             ->  React + TypeScript frontend
    index.html
    vite.config.ts
    tailwind.config.js
    package.json
  package.json       ->  root scripts using concurrently
```

---

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=2,8,15&height=100&section=footer&animation=fadeIn" width="100%"/>

<div align="center">MIT License .... built by <a href="https://github.com/0xnurrabby">0xnurrabby</a></div>
