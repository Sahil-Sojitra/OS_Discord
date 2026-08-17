"use client";

import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api.js';

interface HealthCheckData {
  status: string;
  timestamp: string;
  environment: string;
  uptime: number;
}

export default function Home() {
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
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

      <main className="max-w-md w-full z-10 flex flex-col items-center gap-8">
        {/* Title / Brand */}
        <div className="text-center flex flex-col gap-2">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent drop-shadow-sm select-none">
            OS Discord
          </h1>
          <p className="text-slate-400 text-sm font-medium tracking-wide uppercase">
            Phase 1 Project Scaffolding
          </p>
        </div>

        {/* Status Glassmorphism Card */}
        <div className="w-full bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl transition-all duration-300 hover:border-slate-700/60">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-200">Backend Connection</h2>

            {/* Status Pill */}
            {status === 'loading' && (
              <span className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                Checking
              </span>
            )}
            {status === 'connected' && (
              <span className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Online
              </span>
            )}
            {status === 'disconnected' && (
              <span className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Offline
              </span>
            )}
          </div>

          {/* Card Content */}
          <div className="space-y-4">
            {status === 'loading' && (
              <div className="py-6 flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
                <p className="text-slate-400 text-sm mt-2">Checking backend health...</p>
              </div>
            )}

            {status === 'connected' && data && (
              <div className="space-y-3 font-mono text-xs">
                <div className="flex justify-between py-2 border-b border-slate-800/60">
                  <span className="text-slate-500">Status Code</span>
                  <span className="text-emerald-400 font-bold">{data.status}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800/60">
                  <span className="text-slate-500">Environment</span>
                  <span className="text-indigo-400">{data.environment}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800/60">
                  <span className="text-slate-500">Uptime</span>
                  <span className="text-purple-400">{data.uptime.toFixed(1)} seconds</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-500">API Time</span>
                  <span className="text-slate-400 truncate max-w-[200px]" title={data.timestamp}>
                    {new Date(data.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            )}

            {status === 'disconnected' && (
              <div className="py-2 space-y-4">
                <p className="text-rose-400 text-sm text-center bg-rose-950/20 border border-rose-900/30 rounded-lg p-3 font-mono text-xs break-all">
                  {error || 'Could not connect to the API server.'}
                </p>
                <button
                  onClick={checkHealth}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-lg shadow-lg shadow-indigo-600/20 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                >
                  Retry Connection
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <p className="text-slate-600 text-xs mt-4 select-none">
          Click retry to trigger request validation and CORS checks.
        </p>
      </main>
    </div>
  );
}
