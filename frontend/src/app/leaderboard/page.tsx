'use client';

import { useState, useEffect } from 'react';
import { Trophy, Medal, Award, Flame, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { getApiUrl } from '@/lib/api';

interface LeaderboardEntry {
  id: string;
  username: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(getApiUrl('/api/matches/leaderboard'))
      .then((res) => res.json())
      .then((data) => {
        setLeaderboard(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-8">
      {/* Header */}
      <div className="flex items-center space-x-4 border-b border-zinc-800 pb-6">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
          <Trophy className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">ELO Leaderboard</h1>
          <p className="text-zinc-400 text-sm">Top competitive coders ranked by victory performance in 1v1 duels.</p>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-sm text-zinc-300">
          <thead className="bg-zinc-900 text-xs uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
            <tr>
              <th className="px-6 py-4">Rank</th>
              <th className="px-6 py-4">Player</th>
              <th className="px-6 py-4 text-center">ELO Rating</th>
              <th className="px-6 py-4 text-center">Wins / Losses</th>
              <th className="px-6 py-4 text-right">Win Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                  Loading global rankings...
                </td>
              </tr>
            ) : leaderboard.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                  No ranked matches recorded yet. Play a match to get on the leaderboard!
                </td>
              </tr>
            ) : (
              leaderboard.map((entry, idx) => {
                const totalMatches = entry.wins + entry.losses + entry.draws;
                const winRate = totalMatches > 0 ? Math.round((entry.wins / totalMatches) * 100) : 0;

                const rankBadge =
                  idx === 0 ? (
                    <Medal className="w-5 h-5 text-amber-400 inline" />
                  ) : idx === 1 ? (
                    <Medal className="w-5 h-5 text-slate-300 inline" />
                  ) : idx === 2 ? (
                    <Medal className="w-5 h-5 text-amber-600 inline" />
                  ) : (
                    <span className="font-mono text-zinc-500 font-bold">#{idx + 1}</span>
                  );

                return (
                  <tr key={entry.id} className="hover:bg-zinc-900/50 transition-colors">
                    <td className="px-6 py-4 font-bold">{rankBadge}</td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/profile/${entry.username}`}
                        className="font-bold text-white hover:text-brand-400 transition-colors flex items-center space-x-2"
                      >
                        <UserIcon className="w-4 h-4 text-zinc-500" />
                        <span>{entry.username}</span>
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-mono font-extrabold text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2.5 py-1 rounded-md">
                        {entry.elo} ELO
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-xs">
                      <span className="text-emerald-400 font-bold">{entry.wins}W</span> /{' '}
                      <span className="text-rose-400 font-bold">{entry.losses}L</span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-white">
                      {winRate}%
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
