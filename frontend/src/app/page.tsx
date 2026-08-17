"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth';
import { apiFetch } from '@/lib/api';

interface HealthCheckData {
  status: string;
  timestamp: string;
  environment: string;
  uptime: number;
}

export default function Home() {
  const { user, logout } = useAuth();
  const [status, setStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading');
  const [data, setData] = useState<HealthCheckData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = async () => {
    setStatus('loading');
    setError(null);
    try {
      const res = await apiFetch('/health');
      if (res.ok) {
        const json = (await res.json()) as HealthCheckData;
        setData(json);
        setStatus('connected');
      } else {
        setStatus('disconnected');
        setError(`Server returned status ${res.status}`);
      }
    } catch (err: unknown) {
      setStatus('disconnected');
      setError(
        err instanceof Error ? err.message : 'Network connection failed'
      );
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 relative overflow-hidden font-sans">
      {/* Background ambient glows */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

      <main className="max-w-md w-full z-10 flex flex-col items-center gap-8 animate-in fade-in zoom-in-95 duration-300">
        
        {/* Title / Brand */}
        <div className="text-center flex flex-col gap-2">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent drop-shadow-sm select-none">
            OS Discord
          </h1>
          <p className="text-slate-400 text-sm font-medium tracking-wide uppercase">
            Authentication Integration
          </p>
        </div>

        {/* User Card if Authenticated */}
        {user ? (
          <div className="w-full bg-slate-900/60 backdrop-blur-xl border border-indigo-500/20 rounded-2xl p-6 shadow-2xl transition-all duration-300 hover:border-indigo-500/40 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full flex items-center justify-center font-bold text-lg text-white shadow-inner uppercase select-none">
                {user.username.slice(0, 2)}
              </div>
              <div>
                <p className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Logged in as</p>
                <h2 className="text-xl font-bold text-slate-200">{user.username}</h2>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl font-mono text-[10px] text-slate-400">
                <p className="flex justify-between">
                  <span>User ID:</span>
                  <span className="text-slate-300 select-all">{user.id}</span>
                </p>
                <p className="flex justify-between mt-1">
                  <span>Joined:</span>
                  <span>{new Date(user.createdAt).toLocaleDateString()}</span>
                </p>
              </div>

              <button
                onClick={logout}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium text-sm rounded-xl border border-slate-750 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center"
              >
                Log Out
              </button>
            </div>
          </div>
        ) : (
          /* Landing options if Unauthenticated */
          <div className="w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl text-center space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-slate-200">Get Started</h2>
              <p className="text-slate-400 text-xs leading-relaxed">
                Log in or register to set up your profile and explore the backend authentication layer.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/login"
                className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-indigo-600/15 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center"
              >
                Log In
              </Link>
              <Link
                href="/register"
                className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium text-sm rounded-xl border border-slate-755 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center"
              >
                Register
              </Link>
            </div>
          </div>
        )}

        {/* Backend Status Glassmorphism Card */}
        <div className="w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-2xl transition-all duration-300 hover:border-slate-700/60">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Backend API Health</h3>
            
            {status === 'loading' && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                Checking
              </span>
            )}
            {status === 'connected' && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Online
              </span>
            )}
            {status === 'disconnected' && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Offline
              </span>
            )}
          </div>

          <div className="space-y-3">
            {status === 'loading' && (
              <div className="py-4 flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-slate-800 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            )}

            {status === 'connected' && data && (
              <div className="space-y-2 font-mono text-[10px] text-slate-400">
                <div className="flex justify-between py-1 border-b border-slate-800/40">
                  <span>Server Status</span>
                  <span className="text-emerald-400 font-bold">{data.status}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/40">
                  <span>Environment</span>
                  <span className="text-indigo-400">{data.environment}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Uptime</span>
                  <span className="text-purple-400">{data.uptime.toFixed(1)} seconds</span>
                </div>
              </div>
            )}

            {status === 'disconnected' && (
              <div className="space-y-3">
                <p className="text-rose-400 text-[10px] text-center bg-rose-950/20 border border-rose-900/30 rounded-lg p-2.5 font-mono break-all leading-normal">
                  {error || 'Could not connect to the API server.'}
                </p>
                <button
                  onClick={checkHealth}
                  className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-lg transition-colors duration-150"
                >
                  Retry Connection
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <p className="text-slate-650 text-[10px] select-none uppercase tracking-widest font-semibold">
          Phase 2 • Scaffolding Complete
        </p>
      </main>
    </div>
  );
}
