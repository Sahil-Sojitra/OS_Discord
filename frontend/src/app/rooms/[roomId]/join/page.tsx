"use client";

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth';
import { apiFetch } from '@/lib/api';

export default function JoinRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const roomId = params?.roomId as string;
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId) return;
    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch(`/rooms/${roomId}/join`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Invalid room password');
      }

      // Success: redirect to room detail page
      router.push(`/rooms/${roomId}`);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Invalid password or connection error'
      );
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 font-sans">
        <div className="max-w-sm w-full bg-slate-900/40 border border-slate-850 rounded-2xl p-6 text-center space-y-4">
          <h2 className="text-lg font-bold text-slate-200">Authentication Required</h2>
          <p className="text-slate-400 text-xs">
            Please log in before attempting to join this secure room.
          </p>
          <Link
            href="/login"
            className="inline-block py-2.5 px-4 bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-semibold rounded-xl"
          >
            Log In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 relative overflow-hidden font-sans">
      {/* Background ambient glows */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none" />

      <main className="max-w-md w-full z-10">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/85 rounded-2xl p-8 shadow-2xl transition-all duration-300 hover:border-slate-700/50">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
              Join Secure Room
            </h1>
            <p className="text-slate-400 text-xs truncate max-w-full" title={roomId}>
              Room ID: {roomId}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-455 text-xs font-mono break-words leading-relaxed animate-in fade-in slide-in-from-top-2 duration-200">
              <span className="font-bold uppercase tracking-wider block mb-1">Access Denied:</span>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleJoin} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Room Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-200"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-medium text-sm rounded-xl shadow-lg shadow-indigo-600/15 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:transform-none flex items-center justify-center"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                'Join Room'
              )}
            </button>
          </form>

          {/* Footer Navigation */}
          <div className="mt-8 pt-6 border-t border-slate-800/40 text-center">
            <Link
              href="/"
              className="text-slate-500 hover:text-slate-300 text-xs font-semibold transition-colors duration-150"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
