'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Swords, Trophy, User as UserIcon, PlusCircle, LogOut, Zap } from 'lucide-react';
import { getStoredUser, clearStoredUser, setStoredUser, User } from '@/lib/auth';
import { getApiUrl } from '@/lib/api';

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const handleGuestLogin = async () => {
    try {
      const res = await fetch(getApiUrl('/api/auth/guest'), { method: 'POST' });
      const data = await res.json();
      if (data.user) {
        setStoredUser(data.user, data.token);
        setUser(data.user);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    clearStoredUser();
    setUser(null);
  };

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="bg-gradient-to-tr from-brand-600 to-emerald-400 p-2 rounded-xl text-black shadow-lg shadow-brand-500/20 group-hover:scale-105 transition-transform">
            <Swords className="w-5 h-5 font-bold" />
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight text-white">free-re</span>
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-500 border border-brand-500/20">
              1v1 ARENA
            </span>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center space-x-6">
          <Link href="/leaderboard" className="flex items-center space-x-1.5 text-sm font-medium text-zinc-400 hover:text-white transition-colors">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Leaderboard</span>
          </Link>

          <Link href="/admin/problems" className="flex items-center space-x-1.5 text-sm font-medium text-zinc-400 hover:text-white transition-colors">
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            <span>Problems</span>
          </Link>

          {user ? (
            <div className="flex items-center space-x-4">
              <Link
                href={`/profile/${user.username}`}
                className="flex items-center space-x-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 rounded-lg text-sm transition-all"
              >
                <UserIcon className="w-4 h-4 text-brand-500" />
                <span className="font-semibold text-white">{user.username}</span>
                <span className="text-xs bg-brand-500/20 text-brand-400 px-2 py-0.5 rounded font-mono font-bold">
                  {user.elo} ELO
                </span>
              </Link>
              <button
                onClick={handleLogout}
                className="text-zinc-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-zinc-800/50 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleGuestLogin}
              className="flex items-center space-x-2 bg-brand-500 hover:bg-brand-600 text-black font-bold text-sm px-4 py-2 rounded-lg shadow-lg shadow-brand-500/20 transition-all hover:scale-105"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Quick Guest Play</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
