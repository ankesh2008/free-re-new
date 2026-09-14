'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Swords, Users, Play, Plus, ArrowRight, ShieldCheck, Zap, Code, Trophy } from 'lucide-react';
import { getStoredUser, setStoredUser, User } from '@/lib/auth';
import { getSocket } from '@/lib/socket';

export default function LobbyPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isSearchingQueue, setIsSearchingQueue] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Ensure guest user if none exists
    const currentUser = getStoredUser();
    if (currentUser) {
      setUser(currentUser);
    } else {
      autoGuestLogin();
    }

    const socket = getSocket();

    socket.on('match_found', (data: { roomCode: string }) => {
      setIsSearchingQueue(false);
      router.push(`/battle/${data.roomCode}`);
    });

    return () => {
      socket.off('match_found');
    };
  }, [router]);

  const autoGuestLogin = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/auth/guest', { method: 'POST' });
      const data = await res.json();
      if (data.user) {
        setStoredUser(data.user, data.token);
        setUser(data.user);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuickMatch = () => {
    if (!user) return;
    const socket = getSocket();
    if (!isSearchingQueue) {
      setIsSearchingQueue(true);
      socket.emit('join_queue', {
        id: user.id,
        username: user.username,
        elo: user.elo,
      });
    } else {
      setIsSearchingQueue(false);
      socket.emit('leave_queue');
    }
  };

  const handleCreatePrivateRoom = () => {
    if (!user) return;
    setIsCreatingRoom(true);
    const socket = getSocket();
    socket.emit(
      'create_room',
      { id: user.id, username: user.username, elo: user.elo },
      (res: { roomCode: string; error?: string }) => {
        setIsCreatingRoom(false);
        if (res.roomCode) {
          router.push(`/battle/${res.roomCode}`);
        } else if (res.error) {
          setErrorMsg(res.error);
        }
      }
    );
  };

  const handleJoinPrivateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    router.push(`/battle/${joinCodeInput.trim().toUpperCase()}`);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-12">
      {/* Hero Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-xs font-semibold">
          <Zap className="w-3.5 h-3.5 fill-current" />
          <span>REAL-TIME 1v1 CODE BATTLE PLATFORM</span>
        </div>
        <h1 className="text-5xl font-black tracking-tight text-white sm:text-6xl">
          Code Head-to-Head. <br />
          <span className="bg-gradient-to-r from-brand-400 via-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Climb the ELO Ladder.
          </span>
        </h1>
        <p className="text-zinc-400 text-base sm:text-lg leading-relaxed">
          Solve competitive programming challenges live against real opponents. Real-time CRDT sync, hidden test validation, and 10-minute battle timers.
        </p>
      </div>

      {/* Matchmaking Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* Card 1: Quick Match Queue */}
        <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 hover:border-brand-500/40 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-6 transition-all group">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 group-hover:scale-110 transition-transform">
              <Swords className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-white">Global Quick Match</h2>
            <p className="text-zinc-400 text-sm">
              Automatically pair with a player near your ELO rating for a 10-minute 1v1 duel.
            </p>
          </div>

          <button
            onClick={handleQuickMatch}
            disabled={!user}
            className={`w-full py-4 rounded-xl font-extrabold text-base flex items-center justify-center space-x-3 shadow-lg transition-all ${
              isSearchingQueue
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                : 'bg-brand-500 hover:bg-brand-600 text-black shadow-brand-500/20 hover:scale-[1.02]'
            }`}
          >
            {isSearchingQueue ? (
              <>
                <Zap className="w-5 h-5 animate-spin" />
                <span>Searching Opponent... (Click to Cancel)</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                <span>Find Match Now</span>
              </>
            )}
          </button>
        </div>

        {/* Card 2: Private Room */}
        <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 hover:border-indigo-500/40 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-6 transition-all group">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-white">Private Battle Room</h2>
            <p className="text-zinc-400 text-sm">
              Create a custom room code to challenge a friend or colleague directly.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleCreatePrivateRoom}
              disabled={isCreatingRoom || !user}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl border border-zinc-700 flex items-center justify-center space-x-2 text-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{isCreatingRoom ? 'Creating Room...' : 'Create Private Room'}</span>
            </button>

            <form onSubmit={handleJoinPrivateRoom} className="flex space-x-2">
              <input
                type="text"
                placeholder="Enter Room Code (e.g. A1B2C3)"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-mono uppercase text-white focus:outline-none focus:border-brand-500"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors flex items-center space-x-1"
              >
                <span>Join</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 max-w-4xl mx-auto border-t border-zinc-800/80">
        <div className="bg-zinc-950/60 border border-zinc-800/60 rounded-xl p-4 flex items-start space-x-3">
          <Code className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-white text-sm">CRDT Collaborative Editor</h3>
            <p className="text-zinc-400 text-xs mt-0.5">Monaco + Yjs document synchronization without text overwriting.</p>
          </div>
        </div>

        <div className="bg-zinc-950/60 border border-zinc-800/60 rounded-xl p-4 flex items-start space-x-3">
          <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-white text-sm">Hidden Test Validation</h3>
            <p className="text-zinc-400 text-xs mt-0.5">Submissions run against hidden test cases to declare the winner.</p>
          </div>
        </div>

        <div className="bg-zinc-950/60 border border-zinc-800/60 rounded-xl p-4 flex items-start space-x-3">
          <Trophy className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-white text-sm">Competitive ELO System</h3>
            <p className="text-zinc-400 text-xs mt-0.5">Gain or lose ELO points on every match outcome and climb ranks.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
