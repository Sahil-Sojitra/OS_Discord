"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/auth';
import { apiFetch } from '@/lib/api';
import { useSocket } from '@/context/socket';

interface Member {
  id: string;
  username: string;
}

interface RoomDetail {
  id: string;
  name: string;
  createdBy: string;
  members: Member[];
  createdAt: string;
}

export default function RoomDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { socket } = useSocket();

  const roomId = params?.roomId as string;
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

  // Socket Connection Join/Leave Effect
  useEffect(() => {
    if (!socket || !roomId || !user) return;

    // Join room via socket
    socket.emit('room:join', { roomId }, (ack: any) => {
      if (ack && ack.status === 'ok') {
        console.log('[Socket] Joined room:', roomId);
        setOnlineUserIds([user.id]);
      } else {
        console.error('[Socket] Join failed:', ack?.message);
      }
    });

    // Listen for room updates
    socket.on('user:joined', (data: { userId: string; username: string; roomId: string }) => {
      if (data.roomId === roomId) {
        setOnlineUserIds((prev) => [...new Set([...prev, data.userId])]);
      }
    });

    socket.on('user:left', (data: { userId: string; username: string; roomId: string }) => {
      if (data.roomId === roomId) {
        setOnlineUserIds((prev) => prev.filter((id) => id !== data.userId));
      }
    });

    return () => {
      // Leave room
      socket.emit('room:leave', { roomId });
      socket.off('user:joined');
      socket.off('user:left');
    };
  }, [socket, roomId, user]);

  useEffect(() => {
    if (!user || !roomId) return;

    const fetchRoomDetail = async () => {
      try {
        const res = await apiFetch(`/rooms/${roomId}`);

        if (res.status === 404) {
          // Not found or not a member: redirect to join
          router.push(`/rooms/${roomId}/join`);
          return;
        }

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || 'Failed to load room details');
        }

        setRoom(data.room);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : 'An error occurred loading the room'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchRoomDetail();
  }, [roomId, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center font-sans">
        <div className="w-10 h-10 border-2 border-slate-800 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-slate-500 text-xs mt-4">Loading room details...</p>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 font-sans">
        <div className="max-w-md w-full bg-slate-900/40 border border-slate-850 rounded-2xl p-6 text-center space-y-4">
          <h2 className="text-lg font-bold text-rose-450">Access Denied</h2>
          <p className="text-slate-400 text-xs leading-relaxed">
            {error || 'You do not have access to this room.'}
          </p>
          <Link
            href="/"
            className="inline-block py-2 px-4 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-xl border border-slate-750"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans relative overflow-hidden">
      {/* Sidebar for members list */}
      <aside className="w-64 bg-slate-900/40 border-r border-slate-900 p-6 flex flex-col gap-6 select-none z-10 shrink-0">
        <div className="flex justify-between items-center pb-4 border-b border-slate-900">
          <h2 className="font-bold text-slate-200 text-sm truncate uppercase tracking-wider">
            # {room.name}
          </h2>
          <Link
            href="/"
            className="text-[10px] text-slate-500 hover:text-indigo-400 font-semibold"
          >
            Leave View
          </Link>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Members — {room.members.length}
          </h3>
          <ul className="space-y-2">
            {room.members.map((member) => {
              const isOnline = onlineUserIds.includes(member.id);
              return (
                <li
                  key={member.id}
                  className="flex items-center gap-2 text-xs text-slate-350 hover:text-slate-200 transition-colors duration-150 relative"
                >
                  <div className="relative">
                    <div className="w-6 h-6 bg-slate-800 border border-slate-750 rounded-full flex items-center justify-center font-bold text-[10px] text-slate-300 uppercase">
                      {member.username.slice(0, 2)}
                    </div>
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 block h-1.5 w-1.5 rounded-full bg-emerald-500 ring-1 ring-slate-950" />
                    )}
                  </div>
                  <span className="truncate">{member.username}</span>
                  {member.id === room.createdBy && (
                    <span className="text-[8px] px-1 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded font-semibold uppercase ml-auto">
                      Owner
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="pt-4 border-t border-slate-900 text-[10px] font-mono text-slate-500">
          <p className="truncate" title={room.id}>
            Room ID: {room.id}
          </p>
        </div>
      </aside>

      {/* Main chat window container */}
      <main className="flex-1 flex flex-col z-10 relative bg-slate-950/80">
        {/* Header */}
        <header className="h-16 border-b border-slate-900 flex items-center px-8 shrink-0">
          <h1 className="font-bold text-slate-200 text-base"># {room.name}</h1>
        </header>

        {/* Message section placeholder */}
        <div className="flex-1 flex justify-center items-center p-8">
          <div className="text-center space-y-3 max-w-sm bg-slate-900/20 border border-slate-900/60 rounded-2xl p-6 backdrop-blur-sm">
            <div className="w-12 h-12 rounded-2xl bg-indigo-550/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400 font-bold text-xl select-none">
              #
            </div>
            <h3 className="font-bold text-slate-300 text-sm">Welcome to #{room.name}!</h3>
            <p className="text-slate-500 text-xs leading-normal">
              This is the start of your password-secured channel.
            </p>
            <div className="text-[10px] font-semibold tracking-wider text-indigo-500 bg-indigo-950/10 border border-indigo-900/25 rounded px-2.5 py-1.5 inline-block uppercase font-mono animate-pulse">
              Messages go here (Phase 5)
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
