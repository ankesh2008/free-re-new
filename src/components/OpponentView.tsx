'use client';

import { User, Activity, CheckCircle2, Wifi, WifiOff } from 'lucide-react';

interface OpponentViewProps {
  opponent: {
    id: string;
    username: string;
    elo: number;
    connected: boolean;
  } | null;
  opponentSubmissionStatus?: {
    testsPassed: number;
    totalTests: number;
    status: string;
  } | null;
}

export default function OpponentView({ opponent, opponentSubmissionStatus }: OpponentViewProps) {
  if (!opponent) {
    return (
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3.5 flex items-center justify-between animate-pulse">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-full bg-zinc-800" />
          <div>
            <div className="w-24 h-4 bg-zinc-800 rounded mb-1" />
            <div className="w-16 h-3 bg-zinc-800/60 rounded" />
          </div>
        </div>
        <span className="text-xs text-zinc-500 font-medium">Waiting for opponent...</span>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 flex items-center justify-between shadow-lg">
      <div className="flex items-center space-x-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-white shadow">
            {opponent.username.charAt(0).toUpperCase()}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full bg-zinc-900">
            {opponent.connected ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-rose-500 animate-bounce" />
            )}
          </span>
        </div>

        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-white text-sm">{opponent.username}</span>
            <span className="text-xs font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
              {opponent.elo} ELO
            </span>
          </div>
          <span className="text-xs text-zinc-400 flex items-center space-x-1 mt-0.5">
            <Activity className="w-3 h-3 text-cyan-400 animate-spin" />
            <span>Coding Live</span>
          </span>
        </div>
      </div>

      {/* Opponent Test Pass Counter */}
      {opponentSubmissionStatus && (
        <div className="flex items-center space-x-2 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-lg text-xs font-mono">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>
            {opponentSubmissionStatus.testsPassed} / {opponentSubmissionStatus.totalTests} Passed
          </span>
        </div>
      )}
    </div>
  );
}
