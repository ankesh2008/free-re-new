# free-re ⚔️

> **Real-Time 1v1 Competitive Coding Battle Platform**

`free-re` is a real-time competitive programming battle platform where two players solve the same problem in a shared live editor, submit code against hidden tests, and climb an ELO ladder.

---

## 📁 Repository Structure

```
free-re/
├── backend/                  # Express + Socket.IO server & Prisma ORM
│   ├── prisma/               # Database schema and seed scripts
│   ├── server/               # API routes, socket handlers & execution engine
│   └── package.json
├── frontend/                 # Next.js 14 Web Application
│   ├── src/                  # App Router pages, components & styles
│   └── package.json
└── package.json              # Root launcher (runs both concurrently)
```

---

## ✨ Features

- **⚡ Real-Time 1v1 Battle Arena**: Face opponents head-to-head in synchronized 10-minute coding duels.
- **📝 Collaborative Editor**: Monaco Editor integrated with Socket.IO for multi-cursor live collaboration.
- **🛡️ Hidden Test Case Execution**: Micro-runner supporting JavaScript and Python code execution against visible sample tests and hidden test cases to determine the winner.
- **🏆 ELO Rating System**: Automatic K=32 ELO calculation engine for win, loss, and draw outcomes.
- **👁️ Spectator Mode**: Live dual read-only view of active matches for friends and audiences.
- **📊 User Profiles & Leaderboard**: Global ELO rankings and detailed match history logs.
- **🔧 Admin Problem Portal**: Interface to publish new coding problems with sample and hidden test suites.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
# Install root, backend, and frontend packages
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 2. Set Up Database & Seed Problems
```bash
npm run db:push
npm run db:seed
```

### 3. Run Development Servers Concurrently
```bash
# Run from root directory
npm run dev
```

- **Frontend Application**: http://localhost:3000
- **Backend API & Sockets**: http://localhost:4000
- **ELO Leaderboard**: http://localhost:3000/leaderboard
- **Admin Problem Portal**: http://localhost:3000/admin/problems

---

## 📜 License

MIT License
