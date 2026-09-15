'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { User as UserIcon, Trophy, Swords, Calendar, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { getApiUrl } from '@/lib/api';

export default function UserProfilePage() {
  const params = useParams();
  const username = params.username as string;

  const [data, setData] = useState<{ user: any; matches: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(getApiUrl(`/api/auth/user/${username}`))
      .then((res) => res.json())
      .then((resData) => {
        setData(resData);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [username]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-zinc-500">
        Loading user profile...
      </div>
    );
  }

  if (!data?.user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-rose-400">
        User non-existent or deleted.
      </div>
    );
  }

  const { user, matches } = data;
  const total = user.wins + user.losses + user.draws;
  const winRate = total > 0 ? Math.round((user.wins / total) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
      {/* Profile Header */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between space-y-6 sm:space-y-0 shadow-xl">
        <div className="flex items-center space-x-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-400 text-black font-black text-2xl flex items-center justify-center shadow-lg shadow-brand-500/20">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-white">{user.username}</h1>
            <p className="text-xs text-zinc-400 flex items-center space-x-1 mt-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
            </p>
          </div>
        </div>

        {/* Quick Stats Pill */}
        <div className="flex items-center space-x-4 bg-zinc-900 border border-zinc-800 p-4 rounded-xl font-mono text-center">
          <div>
            <span className="text-xs text-zinc-400 block uppercase">ELO Rating</span>
            <span className="text-2xl font-extrabold text-brand-400">{user.elo}</span>
          </div>
          <div className="w-px h-8 bg-zinc-800" />
          <div>
            <span className="text-xs text-zinc-400 block uppercase">Win Rate</span>
            <span className="text-2xl font-extrabold text-white">{winRate}%</span>
          </div>
          <div className="w-px h-8 bg-zinc-800" />
          <div>
            <span className="text-xs text-zinc-400 block uppercase">Matches</span>
            <span className="text-2xl font-extrabold text-cyan-400">{total}</span>
          </div>
        </div>
      </div>

      {/* Match History */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white flex items-center space-x-2">
          <Swords className="w-5 h-5 text-brand-400" />
          <span>Recent Match History</span>
        </h2>

        {matches.length === 0 ? (
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500 text-sm">
            No past matches found for this player.
          </div>
        ) : (
          <div className="space-y-3">
            {matches.map((m) => {
              const isPlayer1 = m.player1Id === user.id;
              const opponent = isPlayer1 ? m.player2 : m.player1;
              const isWinner = m.winnerId === user.id;
              const isDraw = m.status === 'DRAW' || !m.winnerId;

              return (
                <div
                  key={m.id}
                  className="bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 flex items-center justify-between transition-colors shadow-md text-sm"
                >
                  <div className="flex items-center space-x-4">
                    <div
                      className={`w-3 h-10 rounded-full ${
                        isWinner ? 'bg-emerald-500' : isDraw ? 'bg-blue-500' : 'bg-rose-500'
                      }`}
                    />
                    <div>
                      <div className="font-bold text-white flex items-center space-x-2">
                        <span>vs {opponent?.username || 'Unknown Opponent'}</span>
                        <span className="text-xs text-zinc-500 font-mono">({opponent?.elo || 1200} ELO)</span>
                      </div>
                      <span className="text-xs text-zinc-400 font-mono">{m.problem.title} • {m.problem.difficulty}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <span
                      className={`font-mono font-bold text-sm ${
                        isWinner ? 'text-emerald-400' : isDraw ? 'text-blue-400' : 'text-rose-400'
                      }`}
                    >
                      {isWinner ? 'WIN' : isDraw ? 'DRAW' : 'LOSS'}
                    </span>

                    <Link
                      href={`/battle/${m.roomCode}`}
                      className="text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1"
                    >
                      <span>Room</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
