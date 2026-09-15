'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Swords, Play, Send, Copy, Check, AlertTriangle, Eye, ShieldAlert } from 'lucide-react';
import { getStoredUser, User } from '@/lib/auth';
import { getSocket } from '@/lib/socket';
import ProblemPanel from '@/components/ProblemPanel';
import LiveEditor from '@/components/LiveEditor';
import MatchTimer from '@/components/MatchTimer';
import OpponentView from '@/components/OpponentView';
import WinModal from '@/components/WinModal';

export default function BattleArenaPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = (params.roomCode as string).toUpperCase();

  const [user, setUser] = useState<User | null>(null);
  const [room, setRoom] = useState<any>(null);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState<'javascript' | 'python'>('javascript');
  const [timeRemainingSec, setTimeRemainingSec] = useState(600);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<any>(null);
  const [opponentSubmission, setOpponentSubmission] = useState<any>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Win Modal state
  const [winModalData, setWinModalData] = useState<{
    isOpen: boolean;
    winnerId: string | null;
    reason: string;
    p1EloDelta: number;
    p2EloDelta: number;
  }>({
    isOpen: false,
    winnerId: null,
    reason: '',
    p1EloDelta: 0,
    p2EloDelta: 0,
  });

  useEffect(() => {
    const currentUser = getStoredUser();
    if (!currentUser) {
      router.push('/');
      return;
    }
    setUser(currentUser);

    const socket = getSocket();

    // Join room
    socket.emit(
      'join_room',
      { roomCode, user: { id: currentUser.id, username: currentUser.username, elo: currentUser.elo } },
      (res: any) => {
        if (res.error) {
          alert(res.error);
          router.push('/');
          return;
        }
        if (res.room) {
          setRoom(res.room);
          if (res.room.problem) {
            setCode(language === 'javascript' ? res.room.problem.initialJS : res.room.problem.initialPy);
          }
        }
      }
    );

    // Socket Event Listeners
    socket.on('room_updated', (data: { room: any }) => {
      setRoom(data.room);
    });

    socket.on('timer_tick', (data: { timeRemainingSec: number }) => {
      setTimeRemainingSec(data.timeRemainingSec);
    });

    socket.on('submission_attempt', (data: { userId: string; testsPassed: number; totalTests: number; status: string }) => {
      if (currentUser && data.userId !== currentUser.id) {
        setOpponentSubmission({
          testsPassed: data.testsPassed,
          totalTests: data.totalTests,
          status: data.status,
        });
      }
    });

    socket.on('match_ended', (data: { winnerId: string | null; reason: string; player1EloDelta: number; player2EloDelta: number }) => {
      setWinModalData({
        isOpen: true,
        winnerId: data.winnerId,
        reason: data.reason,
        p1EloDelta: data.player1EloDelta,
        p2EloDelta: data.player2EloDelta,
      });
    });

    return () => {
      socket.off('room_updated');
      socket.off('timer_tick');
      socket.off('submission_attempt');
      socket.off('match_ended');
    };
  }, [roomCode, router]);

  const handleLanguageChange = (lang: 'javascript' | 'python') => {
    setLanguage(lang);
    if (room?.problem) {
      setCode(lang === 'javascript' ? room.problem.initialJS : room.problem.initialPy);
    }
  };

  const handleRunSampleTests = () => {
    setIsRunningTests(true);
    setConsoleOutput(null);

    const socket = getSocket();
    socket.emit('run_code', { roomCode, code, language }, (res: any) => {
      setIsRunningTests(false);
      setConsoleOutput(res);
    });
  };

  const handleSubmitCode = () => {
    if (!user) return;
    setIsSubmitting(true);
    setConsoleOutput(null);

    const socket = getSocket();
    socket.emit(
      'submit_code',
      { roomCode, userId: user.id, code, language },
      (res: any) => {
        setIsSubmitting(false);
        setConsoleOutput(res);
      }
    );
  };

  const handleForfeit = () => {
    if (!user || !confirm('Are you sure you want to forfeit this match?')) return;
    const socket = getSocket();
    socket.emit('forfeit_match', { roomCode, userId: user.id });
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const isPlayer1 = room?.player1?.id === user?.id;
  const opponent = isPlayer1 ? room?.player2 : room?.player1;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-dark-950">
      {/* Top Match Bar */}
      <div className="h-16 border-b border-zinc-800 bg-zinc-950 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg">
            <span className="text-xs font-semibold text-zinc-400">ROOM:</span>
            <span className="font-mono font-bold text-brand-400">{roomCode}</span>
            <button
              onClick={handleCopyLink}
              className="text-zinc-500 hover:text-white transition-colors"
              title="Copy Match Link"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <div className="hidden md:flex items-center space-x-2 text-xs text-zinc-400">
            <span>Status:</span>
            <span className="font-semibold text-emerald-400 uppercase tracking-wider">
              {room?.status || 'CONNECTING...'}
            </span>
          </div>
        </div>

        {/* Center: Synced Timer */}
        <MatchTimer timeRemainingSec={timeRemainingSec} />

        {/* Right: Actions & Spectator link */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => router.push(`/spectator/${roomCode}`)}
            className="flex items-center space-x-1.5 text-xs text-zinc-400 hover:text-cyan-400 bg-zinc-900 hover:bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-800 transition-colors"
          >
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">Spectator View</span>
          </button>

          <button
            onClick={handleForfeit}
            className="text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 rounded-lg border border-rose-500/20 transition-colors"
          >
            Forfeit
          </button>
        </div>
      </div>

      {/* Main Arena Workspace */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3 p-3 min-h-0 overflow-hidden">
        {/* Left Column: Problem Panel */}
        <div className="md:col-span-5 h-full overflow-hidden">
          <ProblemPanel problem={room?.problem} />
        </div>

        {/* Right Column: Code Editor & Execution Panel */}
        <div className="md:col-span-7 h-full flex flex-col space-y-3 overflow-hidden">
          {/* Opponent Status Header */}
          <OpponentView opponent={opponent} opponentSubmissionStatus={opponentSubmission} />

          {/* Editor Header / Toolbar */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-t-xl px-4 py-2 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-zinc-400">Language:</span>
              <button
                onClick={() => handleLanguageChange('javascript')}
                className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${
                  language === 'javascript'
                    ? 'bg-brand-500 text-black font-bold'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                JavaScript
              </button>
              <button
                onClick={() => handleLanguageChange('python')}
                className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${
                  language === 'python'
                    ? 'bg-brand-500 text-black font-bold'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                Python
              </button>
            </div>

            <span className="text-xs text-zinc-500 font-mono hidden sm:inline">
              CRDT Sync Active
            </span>
          </div>

          {/* Monaco Live Editor */}
          <div className="flex-1 min-h-0 relative">
            <LiveEditor
              roomCode={roomCode}
              code={code}
              language={language}
              onChange={(val) => setCode(val)}
            />
          </div>

          {/* Console Drawer / Execution Output */}
          {consoleOutput && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 max-h-48 overflow-y-auto font-mono text-xs space-y-2">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="font-bold text-zinc-300">Test Execution Output</span>
                <span
                  className={`font-semibold ${
                    consoleOutput.status === 'ACCEPTED' ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {consoleOutput.status} ({consoleOutput.testsPassed} / {consoleOutput.totalTests} Passed)
                </span>
              </div>

              {consoleOutput.results?.map((res: any, idx: number) => (
                <div
                  key={idx}
                  className={`p-2 rounded border ${
                    res.passed ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                  }`}
                >
                  <div className="font-bold">Test Case #{idx + 1}: {res.passed ? 'PASSED ✅' : 'FAILED ❌'}</div>
                  {res.actual && <div>Actual: {res.actual}</div>}
                  <div>Expected: {res.expected}</div>
                  {res.error && <div className="text-rose-400 mt-1">Error: {res.error}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Action Bar */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 flex items-center justify-between shrink-0">
            <button
              onClick={handleRunSampleTests}
              disabled={isRunningTests || isSubmitting}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold px-4 py-2.5 rounded-lg border border-zinc-700 flex items-center space-x-2 transition-colors"
            >
              <Play className="w-4 h-4 fill-current text-brand-400" />
              <span>{isRunningTests ? 'Executing Samples...' : 'Run Sample Tests'}</span>
            </button>

            <button
              onClick={handleSubmitCode}
              disabled={isRunningTests || isSubmitting || room?.status === 'FINISHED'}
              className="bg-gradient-to-r from-brand-500 to-emerald-400 hover:from-brand-600 hover:to-emerald-500 text-black text-xs font-extrabold px-6 py-2.5 rounded-lg shadow-lg shadow-brand-500/20 flex items-center space-x-2 transition-transform hover:scale-105"
            >
              <Send className="w-4 h-4 fill-current" />
              <span>{isSubmitting ? 'Validating Hidden Tests...' : 'Submit Final Solution'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Outcome Modal Overlay */}
      <WinModal
        isOpen={winModalData.isOpen}
        winnerId={winModalData.winnerId}
        currentUserId={user?.id || ''}
        reason={winModalData.reason}
        p1EloDelta={winModalData.p1EloDelta}
        p2EloDelta={winModalData.p2EloDelta}
        isPlayer1={isPlayer1}
        onClose={() => setWinModalData((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
