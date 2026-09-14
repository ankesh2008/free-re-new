# free-re ⚔️

> **Real-Time 1v1 Competitive Coding Battle Platform**

`free-re` is a real-time competitive programming battle platform where two players solve the same problem in a shared live editor, submit code against hidden tests, and climb an ELO ladder.

---

## ✨ Features

- **⚡ Real-Time 1v1 Battle Arena**: Face opponents head-to-head in synchronized 10-minute coding duels.
- **📝 Collaborative Editor**: Monaco Editor integrated with CRDT / WebSockets for multi-cursor live collaboration.
- **🛡️ Hidden Test Case Execution**: Micro-runner supporting JavaScript and Python code execution against visible sample tests and hidden test cases to determine the winner.
- **🏆 ELO Rating System**: Automatic K=32 ELO calculation engine for win, loss, and draw outcomes.
- **👁️ Spectator Mode**: Live dual read-only view of active matches for friends and audiences.
- **📊 User Profiles & Leaderboard**: Global ELO rankings and detailed match history logs.
- **🔧 Admin Problem Portal**: Interface to publish new coding problems with sample and hidden test suites.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 (App Router), Tailwind CSS, Monaco Editor (`@monaco-editor/react`), Lucide Icons, Socket.IO Client.
- **Backend**: Node.js, Express, Socket.IO, Prisma ORM.
- **Database**: SQLite (local development) / PostgreSQL (production ready).
- **Execution Engine**: Dual micro-runner (supports Judge0 CE API + local Node/Python process execution).

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Database & Seed Problems
```bash
npx prisma db push
npx tsx prisma/seed.ts
```

### 3. Run Development Servers
```bash
npm run dev
```

- **Frontend**: http://localhost:3000
- **Backend Server**: http://localhost:4000
- **Leaderboard**: http://localhost:3000/leaderboard
- **Admin Portal**: http://localhost:3000/admin/problems

---

## 📜 License

MIT License
