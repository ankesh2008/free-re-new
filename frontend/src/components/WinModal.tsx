'use client';

import Link from 'next/link';
import { Trophy, Frown, Equal, ArrowRight, Swords } from 'lucide-react';

interface WinModalProps {
  isOpen: boolean;
  winnerId: string | null;
  currentUserId: string;
  reason: string;
  p1EloDelta: number;
  p2EloDelta: number;
  isPlayer1: boolean;
  onClose: () => void;
}

export default function WinModal({
  isOpen,
  winnerId,
  currentUserId,
  reason,
  p1EloDelta,
  p2EloDelta,
  isPlayer1,
  onClose,
}: WinModalProps) {
  if (!isOpen) return null;

  const isWinner = winnerId === currentUserId;
  const isDraw = !winnerId;

  const userEloDelta = isPlayer1 ? p1EloDelta : p2EloDelta;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl space-y-6">
        {/* Outcome Icon & Title */}
        <div className="flex flex-col items-center space-y-3">
          {isWinner ? (
            <div className="w-20 h-20 bg-amber-500/20 border-2 border-amber-400 text-amber-400 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/20 animate-bounce">
              <Trophy className="w-10 h-10" />
            </div>
          ) : isDraw ? (
            <div className="w-20 h-20 bg-blue-500/20 border-2 border-blue-400 text-blue-400 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Equal className="w-10 h-10" />
            </div>
          ) : (
            <div className="w-20 h-20 bg-rose-500/20 border-2 border-rose-500 text-rose-400 rounded-full flex items-center justify-center shadow-lg shadow-rose-500/20">
              <Frown className="w-10 h-10" />
            </div>
          )}

          <h2 className="text-3xl font-extrabold tracking-tight text-white">
            {isWinner ? 'VICTORY!' : isDraw ? 'MATCH DRAW' : 'DEFEAT'}
          </h2>
          <p className="text-sm text-zinc-400 max-w-xs leading-relaxed">{reason}</p>
        </div>

        {/* ELO Rating Delta */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between font-mono">
          <span className="text-xs uppercase text-zinc-400 tracking-wider">Rating Change</span>
          <div
            className={`text-lg font-bold ${
              userEloDelta > 0
                ? 'text-emerald-400'
                : userEloDelta < 0
                ? 'text-rose-400'
                : 'text-zinc-400'
            }`}
          >
            {userEloDelta > 0 ? `+${userEloDelta}` : userEloDelta} ELO
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col space-y-3">
          <Link
            href="/"
            className="w-full bg-brand-500 hover:bg-brand-600 text-black font-bold py-3 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-brand-500/20 transition-transform hover:scale-[1.02]"
          >
            <Swords className="w-5 h-5 fill-current" />
            <span>Play Next Match</span>
          </Link>
          <button
            onClick={onClose}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold py-2.5 rounded-xl border border-zinc-800 text-sm transition-colors"
          >
            Review Code & Arena
          </button>
        </div>
      </div>
    </div>
  );
}
