'use client';

import { FileText, CheckCircle2, ShieldAlert } from 'lucide-react';

interface TestCase {
  input: string;
  expected: string;
}

interface ProblemPanelProps {
  problem: {
    title: string;
    difficulty: string;
    description: string;
    sampleTests?: string;
  } | null;
}

export default function ProblemPanel({ problem }: ProblemPanelProps) {
  if (!problem) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-zinc-500">
        Loading problem...
      </div>
    );
  }

  const sampleTests: TestCase[] = problem.sampleTests ? JSON.parse(problem.sampleTests) : [];

  const difficultyColor =
    problem.difficulty === 'Easy'
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      : problem.difficulty === 'Medium'
      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

  return (
    <div className="h-full flex flex-col bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
        <div className="flex items-center space-x-3">
          <FileText className="w-5 h-5 text-brand-500" />
          <h2 className="font-bold text-lg text-white">{problem.title}</h2>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${difficultyColor}`}>
          {problem.difficulty}
        </span>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 text-sm text-zinc-300">
        {/* Description */}
        <div className="prose prose-invert max-w-none space-y-3 whitespace-pre-line leading-relaxed">
          {problem.description}
        </div>

        {/* Sample Test Cases */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Sample Test Cases</span>
          </h3>

          <div className="space-y-3">
            {sampleTests.map((tc, idx) => (
              <div key={idx} className="bg-zinc-900 border border-zinc-800/80 rounded-lg p-3 space-y-2 font-mono text-xs">
                <div>
                  <span className="text-zinc-500 block mb-1">Input:</span>
                  <div className="bg-zinc-950 p-2 rounded text-emerald-300 border border-zinc-800">
                    {tc.input}
                  </div>
                </div>
                <div>
                  <span className="text-zinc-500 block mb-1">Expected Output:</span>
                  <div className="bg-zinc-950 p-2 rounded text-cyan-300 border border-zinc-800">
                    {tc.expected}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hidden Test Notice */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3.5 flex items-start space-x-3 text-xs text-amber-300">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block mb-0.5">Hidden Test Cases Active</span>
            <span>Submissions are validated against additional unrevealed test cases to determine the winner.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
