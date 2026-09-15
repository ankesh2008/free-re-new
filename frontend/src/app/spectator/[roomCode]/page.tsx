'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Eye, Swords, ShieldCheck, Clock } from 'lucide-react';
import { getSocket } from '@/lib/socket';
import LiveEditor from '@/components/LiveEditor';
import ProblemPanel from '@/components/ProblemPanel';

export default function SpectatorPage() {
  const params = useParams();
  const roomCode = (params.roomCode as string).toUpperCase();

  const [room, setRoom] = useState<any>(null);
  const [player1Code, setPlayer1Code] = useState('');
  const [player2Code, setPlayer2Code] = useState('');
  const [timeRemainingSec, setTimeRemainingSec] = useState(600);

  useEffect(() => {
    const socket = getSocket();

    socket.emit('join_room', { roomCode, user: { id: 'spectator', username: 'Spectator', elo: 0 } }, (res: any) => {
      if (res.room) setRoom(res.room);
    });

    socket.on('room_updated', (data: { room: any }) => {
      setRoom(data.room);
    });

    socket.on('timer_tick', (data: { timeRemainingSec: number }) => {
      setTimeRemainingSec(data.timeRemainingSec);
    });

    socket.on('opponent_code_update', (data: { code: string; senderSocketId: string }) => {
      if (data.senderSocketId === room?.player1?.socketId) {
        setPlayer1Code(data.code);
      } else {
        setPlayer2Code(data.code);
      }
    });

    return () => {
      socket.off('room_updated');
      socket.off('timer_tick');
      socket.off('opponent_code_update');
    };
  }, [roomCode, room?.player1?.socketId]);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-dark-950">
      {/* Spectator Header */}
      <div className="h-14 border-b border-zinc-800 bg-zinc-950 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-3 py-1 rounded-lg text-xs font-bold">
            <Eye className="w-4 h-4" />
            <span>SPECTATOR MODE</span>
          </div>
          <span className="text-sm font-mono text-zinc-400">ROOM: {roomCode}</span>
        </div>

        <div className="font-mono text-sm font-bold text-brand-400">
          Time: {Math.floor(timeRemainingSec / 60)}:{(timeRemainingSec % 60).toString().padStart(2, '0')}
        </div>
      </div>

      {/* Main Dual Arena Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 min-h-0 overflow-hidden">
        {/* Player 1 View */}
        <div className="flex flex-col space-y-2 h-full overflow-hidden">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
            <span className="font-bold text-sm text-white">
              Player 1: {room?.player1?.username || 'Waiting...'} ({room?.player1?.elo || 1200} ELO)
            </span>
            <span className="text-xs bg-brand-500/20 text-brand-400 px-2 py-0.5 rounded font-mono">
              P1 LIVE
            </span>
          </div>
          <div className="flex-1 min-h-0">
            <LiveEditor
              roomCode={roomCode}
              code={player1Code || room?.problem?.initialJS || ''}
              language="javascript"
              onChange={() => {}}
              readOnly={true}
            />
          </div>
        </div>

        {/* Player 2 View */}
        <div className="flex flex-col space-y-2 h-full overflow-hidden">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
            <span className="font-bold text-sm text-white">
              Player 2: {room?.player2?.username || 'Waiting...'} ({room?.player2?.elo || 1200} ELO)
            </span>
            <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded font-mono">
              P2 LIVE
            </span>
          </div>
          <div className="flex-1 min-h-0">
            <LiveEditor
              roomCode={roomCode}
              code={player2Code || room?.problem?.initialJS || ''}
              language="javascript"
              onChange={() => {}}
              readOnly={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
