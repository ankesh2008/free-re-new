'use client';

import { Clock } from 'lucide-react';

interface MatchTimerProps {
  timeRemainingSec: number;
}

export default function MatchTimer({ timeRemainingSec }: MatchTimerProps) {
  const mins = Math.floor(timeRemainingSec / 60);
  const secs = timeRemainingSec % 60;
  const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  const isLowTime = timeRemainingSec < 120; // less than 2 mins
  const progressPercent = Math.max(0, (timeRemainingSec / 600) * 100);

  return (
    <div className="flex flex-col items-center">
      <div
        className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg border font-mono font-bold text-sm shadow-inner transition-colors ${
          isLowTime
            ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 animate-pulse'
            : 'bg-zinc-900 text-brand-400 border-zinc-800'
        }`}
      >
        <Clock className="w-4 h-4" />
        <span>{formatted}</span>
      </div>

      <div className="w-28 bg-zinc-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ${
            isLowTime ? 'bg-rose-500' : 'bg-brand-500'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
