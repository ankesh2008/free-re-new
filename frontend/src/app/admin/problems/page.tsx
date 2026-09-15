'use client';

import { useState, useEffect } from 'react';
import { PlusCircle, FileText } from 'lucide-react';
import { getApiUrl } from '@/lib/api';

export default function AdminProblemsPage() {
  const [problems, setProblems] = useState<any[]>([]);

  // Form state
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [description, setDescription] = useState('');
  const [initialJS, setInitialJS] = useState('function solution(input) {\n  // Write code\n}');
  const [initialPy, setInitialPy] = useState('def solution(input):\n    # Write code\n    pass');
  const [sampleTests, setSampleTests] = useState('[{"input": "[2, 7]", "expected": "9"}]');
  const [hiddenTests, setHiddenTests] = useState('[{"input": "[2, 7]", "expected": "9"}]');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetchProblems();
  }, []);

  const fetchProblems = () => {
    fetch(getApiUrl('/api/problems'))
      .then((res) => res.json())
      .then((data) => {
        setProblems(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error(err));
  };

  const handleCreateProblem = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');

    const token = typeof window !== 'undefined' ? localStorage.getItem('freere_token') : null;

    try {
      const res = await fetch(getApiUrl('/api/problems'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          title,
          difficulty,
          description,
          initialJS,
          initialPy,
          sampleTests,
          hiddenTests,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setMsg('Problem created successfully!');
        setTitle('');
        setDescription('');
        fetchProblems();
      } else {
        setMsg(`Error: ${data.error?.message || data.error || 'Failed to create problem'}`);
      }
    } catch (err: any) {
      setMsg(`Error: ${err.message}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 space-y-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Admin Problem Portal</h1>
          <p className="text-zinc-400 text-sm">Create and seed competitive programming problems with hidden test validation.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left: Create Form */}
        <div className="md:col-span-7 bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <PlusCircle className="w-5 h-5 text-emerald-400" />
            <span>Add New Problem</span>
          </h2>

          {msg && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              {msg}
            </div>
          )}

          <form onSubmit={handleCreateProblem} className="space-y-4 text-xs font-mono">
            <div>
              <label className="text-zinc-400 block mb-1 font-sans text-xs">Problem Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Valid Palindrome II"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-white font-sans text-sm focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-zinc-400 block mb-1 font-sans text-xs">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-white font-sans text-sm"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-zinc-400 block mb-1 font-sans text-xs">Problem Description (Markdown supported)</label>
              <textarea
                rows={4}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe problem inputs, outputs, constraints, examples..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-white font-sans text-sm focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="text-zinc-400 block mb-1 font-sans text-xs">Initial JavaScript Starter</label>
              <textarea
                rows={3}
                value={initialJS}
                onChange={(e) => setInitialJS(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-emerald-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-zinc-400 block mb-1 font-sans text-xs">Initial Python Starter</label>
              <textarea
                rows={3}
                value={initialPy}
                onChange={(e) => setInitialPy(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-zinc-400 block mb-1 font-sans text-xs">Sample Tests (JSON Array)</label>
              <textarea
                rows={2}
                value={sampleTests}
                onChange={(e) => setSampleTests(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-amber-300 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-zinc-400 block mb-1 font-sans text-xs">Hidden Test Cases (JSON Array for Win Validation)</label>
              <textarea
                rows={3}
                value={hiddenTests}
                onChange={(e) => setHiddenTests(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-rose-300 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-brand-500 hover:bg-brand-600 text-black font-extrabold font-sans py-3 rounded-xl shadow-lg transition-transform hover:scale-[1.01]"
            >
              Publish Problem
            </button>
          </form>
        </div>

        {/* Right: Existing Problems List */}
        <div className="md:col-span-5 space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <FileText className="w-5 h-5 text-brand-400" />
            <span>Existing Problems ({problems.length})</span>
          </h2>

          <div className="space-y-3">
            {problems.map((prob) => (
              <div key={prob.id} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white text-base">{prob.title}</h3>
                  <span className="text-xs font-mono bg-zinc-900 border border-zinc-800 text-brand-400 px-2 py-0.5 rounded">
                    {prob.difficulty}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 font-mono">Slug: {prob.slug}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
