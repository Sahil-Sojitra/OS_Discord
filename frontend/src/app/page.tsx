"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth';
import { apiFetch } from '@/lib/api';

interface Room {
  id: string;
  name: string;
  memberCount: number;
  createdAt: string;
}

export default function Home() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);

  // Room Creation States
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomPassword, setNewRoomPassword] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  // Join Room States
  const [joinRoomId, setJoinRoomId] = useState('');

  const fetchRooms = async () => {
    if (!user) return;
    setRoomsLoading(true);
    try {
      const res = await apiFetch('/rooms/mine');
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
      }
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    } finally {
      setRoomsLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [user]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateLoading(true);

    try {
      const res = await apiFetch('/rooms', {
        method: 'POST',
        body: JSON.stringify({ name: newRoomName, password: newRoomPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to create room');
      }

      // Redirect immediately to the newly created room
      router.push(`/rooms/${data.room.id}`);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'An error occurred');
      setCreateLoading(false);
    }
  };

  const handleJoinRedirect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinRoomId.trim()) return;
    router.push(`/rooms/${joinRoomId.trim()}/join`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 relative overflow-hidden font-sans flex flex-col items-center justify-start">
      {/* Background ambient glows */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 select-none pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 select-none pointer-events-none" />

      <header className="w-full max-w-6xl flex justify-between items-center mb-10 pb-6 border-b border-slate-900 z-10">
        <h1 className="text-2xl font-black bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent tracking-wider uppercase select-none">
          OS Discord
        </h1>
        {user && (
          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-sm">
              Logged in as <strong className="text-slate-200">{user.username}</strong>
            </span>
            <button
              onClick={logout}
              className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-semibold text-slate-300 hover:text-white transition-all duration-150"
            >
              Log Out
            </button>
          </div>
        )}
      </header>

      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-8 z-10">
        {user ? (
          <>
            {/* Rooms List Section (Takes up 2 columns on large devices) */}
            <section className="lg:col-span-2 space-y-6">
              <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                My Rooms
                <span className="text-xs px-2 py-0.5 bg-slate-900 border border-slate-850 rounded-full font-mono text-slate-400 font-normal">
                  {rooms.length}
                </span>
              </h2>

              {roomsLoading ? (
                <div className="h-48 border border-slate-900 rounded-2xl flex justify-center items-center">
                  <div className="w-8 h-8 border-2 border-slate-800 border-t-indigo-500 rounded-full animate-spin" />
                </div>
              ) : rooms.length === 0 ? (
                <div className="h-48 border border-dashed border-slate-800 rounded-2xl flex flex-col justify-center items-center p-6 text-center">
                  <p className="text-slate-400 text-sm mb-2">You aren't in any rooms yet.</p>
                  <p className="text-slate-600 text-xs">Create a new room or use a room ID to join one.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rooms.map((room) => (
                    <Link
                      key={room.id}
                      href={`/rooms/${room.id}`}
                      className="group bg-slate-900/40 hover:bg-slate-900/70 border border-slate-850 hover:border-indigo-500/30 rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5 shadow-md flex flex-col justify-between h-36"
                    >
                      <div>
                        <h3 className="font-bold text-slate-200 group-hover:text-indigo-400 transition-colors duration-150 truncate">
                          # {room.name}
                        </h3>
                        <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mt-1 font-mono">
                          ID: {room.id}
                        </p>
                      </div>
                      <div className="flex justify-between items-center text-xs text-slate-400">
                        <span>{room.memberCount} members</span>
                        <span className="text-[10px] text-slate-550">
                          {new Date(room.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Room Actions Side bar (Takes 1 column) */}
            <aside className="space-y-6">
              {/* Join Room Form */}
              <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-6 shadow-xl">
                <h3 className="font-bold text-slate-200 mb-4 text-sm uppercase tracking-wider">
                  Join a Room
                </h3>
                <form onSubmit={handleJoinRedirect} className="space-y-3">
                  <input
                    type="text"
                    required
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value)}
                    placeholder="Enter Room ID"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-200 font-mono"
                  />
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-650 text-white text-xs font-semibold rounded-xl transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0"
                  >
                    Enter Room
                  </button>
                </form>
              </div>

              {/* Create Room Form */}
              <div className="bg-slate-900/30 border border-slate-850 rounded-2xl p-6 shadow-xl">
                <h3 className="font-bold text-slate-200 mb-4 text-sm uppercase tracking-wider">
                  Create a Room
                </h3>
                {createError && (
                  <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-mono leading-relaxed">
                    {createError}
                  </div>
                )}
                <form onSubmit={handleCreateRoom} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Room Name
                    </label>
                    <input
                      type="text"
                      required
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      placeholder="e.g. general"
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-200"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Room Password
                    </label>
                    <input
                      type="password"
                      required
                      value={newRoomPassword}
                      onChange={(e) => setNewRoomPassword(e.target.value)}
                      placeholder="Minimum 4 characters"
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-200"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={createLoading}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/50 text-white text-xs font-semibold rounded-xl transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center"
                  >
                    {createLoading ? (
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Create Room'
                    )}
                  </button>
                </form>
              </div>
            </aside>
          </>
        ) : (
          <section className="col-span-3 max-w-md mx-auto w-full bg-slate-900/40 border border-slate-850 rounded-2xl p-8 text-center space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-200">OS Discord Portfolio</h2>
              <p className="text-slate-400 text-xs leading-relaxed">
                Log in or register to join chat rooms and collaborate.
              </p>
            </div>
            <div className="flex gap-4">
              <Link
                href="/login"
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all duration-150 hover:-translate-y-0.5"
              >
                Log In
              </Link>
              <Link
                href="/register"
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-750 transition-all duration-150 hover:-translate-y-0.5"
              >
                Register
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
