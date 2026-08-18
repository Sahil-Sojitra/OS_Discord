"use client";

import { useEffect, useState, useRef } from 'react';
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

  // Messaging States
  const [messages, setMessages] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [paginationLoading, setPaginationLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const messageContainerRef = useRef<HTMLDivElement | null>(null);

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

    // Listen for live new messages from other users
    socket.on('message:new', (data: { message: any }) => {
      // Ignore messages sent by ourselves (handled optimistically with acks)
      if (data.message.senderId.id === user.id) return;

      setMessages((prev) => [...prev, data.message]);

      // Autoscroll to bottom if user is close to the bottom
      setTimeout(() => {
        const container = messageContainerRef.current;
        if (container) {
          const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
          if (isNearBottom) {
            container.scrollTop = container.scrollHeight;
          }
        }
      }, 50);
    });

    return () => {
      // Leave room
      socket.emit('room:leave', { roomId });
      socket.off('user:joined');
      socket.off('user:left');
      socket.off('message:new');
    };
  }, [socket, roomId, user]);

  // Load history and details
  useEffect(() => {
    if (!user || !roomId) return;

    const loadData = async () => {
      try {
        // Fetch room metadata
        const roomRes = await apiFetch(`/rooms/${roomId}`);
        if (roomRes.status === 404) {
          router.push(`/rooms/${roomId}/join`);
          return;
        }
        const roomData = await roomRes.json();
        if (!roomRes.ok) {
          throw new Error(roomData.error?.message || 'Failed to load room details');
        }
        setRoom(roomData.room);

        // Fetch initial messages history
        const msgRes = await apiFetch(`/rooms/${roomId}/messages?limit=50`);
        if (msgRes.ok) {
          const msgData = await msgRes.json();
          // Server returns newest first (descending). Reverse to show oldest at the top.
          const reversed = [...(msgData.messages || [])].reverse();
          setMessages(reversed);
          setNextCursor(msgData.nextCursor);
          setHasMore(msgData.nextCursor !== null);

          // Scroll to the bottom of the feed initially
          setTimeout(() => {
            if (messageContainerRef.current) {
              messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
            }
          }, 50);
        }
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : 'An error occurred loading the room'
        );
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [roomId, user, router]);

  // Paginated scrolling load handler
  const handleScroll = async () => {
    const container = messageContainerRef.current;
    if (!container || !hasMore || paginationLoading || !nextCursor) return;

    // Trigger load if user scrolls to top (within 50px of topmost boundary)
    if (container.scrollTop <= 50) {
      setPaginationLoading(true);
      const prevScrollHeight = container.scrollHeight;

      try {
        const res = await apiFetch(`/rooms/${roomId}/messages?before=${nextCursor}&limit=50`);
        if (res.ok) {
          const data = await res.json();
          const reversedNew = [...(data.messages || [])].reverse();

          setMessages((prev) => [...reversedNew, ...prev]);
          setNextCursor(data.nextCursor);
          setHasMore(data.nextCursor !== null);

          // Pin the scrolling position so the viewport doesn't jump
          setTimeout(() => {
            container.scrollTop = container.scrollHeight - prevScrollHeight;
          }, 0);
        }
      } catch (err) {
        console.error('Failed to load older messages:', err);
      } finally {
        setPaginationLoading(false);
      }
    }
  };

  // Submit and send message handler
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !socket || !user || !roomId) return;

    const content = inputValue.trim();
    setInputValue(''); // Reset field input

    const tempId = crypto.randomUUID();
    const optimisticMsg = {
      id: tempId,
      content,
      roomId,
      senderId: {
        id: user.id,
        username: user.username,
      },
      createdAt: new Date().toISOString(),
      sending: true, // Optimistic UI marker
    };

    // Prepend/append to current message set
    setMessages((prev) => [...prev, optimisticMsg]);

    // Force snap scrolling to bottom on your own send action
    setTimeout(() => {
      if (messageContainerRef.current) {
        messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
      }
    }, 50);

    // Send payload over sockets
    socket.emit('message:send', { roomId, content, tempId }, (ack: any) => {
      if (ack && ack.status === 'ok') {
        // Swap out the optimistic temp message with server confirmed canonical record
        setMessages((prev) =>
          prev.map((msg) => (msg.id === ack.tempId ? ack.message : msg))
        );
      } else {
        console.error('[Socket] Message delivery failed:', ack?.message);
        // Toggle the message state to failed
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId ? { ...msg, sending: false, error: true } : msg
          )
        );
      }
    });
  };

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

        {/* Messages Feed View */}
        <div
          ref={messageContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-8 py-6 space-y-4"
        >
          {paginationLoading && (
            <div className="flex justify-center py-2">
              <div className="w-5 h-5 border-2 border-slate-800 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          )}

          {messages.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center text-center space-y-3 max-w-sm mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-indigo-550/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xl select-none">
                #
              </div>
              <h3 className="font-bold text-slate-300 text-sm">Welcome to #{room.name}!</h3>
              <p className="text-slate-500 text-xs leading-normal">
                This is the start of your password-secured channel.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isSelf = msg.senderId.id === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[70%] group ${
                    isSelf ? 'ml-auto items-end' : 'mr-auto items-start'
                  }`}
                >
                  {/* Sender metadata and timestamp */}
                  <div className="flex items-center gap-2 mb-1 text-[10px] text-slate-500">
                    <span className="font-bold text-slate-400">
                      {isSelf ? 'You' : msg.senderId.username}
                    </span>
                    <span>•</span>
                    <span>
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Content Bubble */}
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed break-words whitespace-pre-wrap ${
                      isSelf
                        ? 'bg-indigo-650 text-white rounded-tr-none shadow-md shadow-indigo-600/5'
                        : 'bg-slate-900/60 text-slate-200 border border-slate-850 rounded-tl-none'
                    } ${msg.sending ? 'opacity-50 animate-pulse' : ''} ${
                      msg.error ? 'border-rose-500/40 bg-rose-950/20 text-rose-350' : ''
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* Failed status notice */}
                  {msg.error && (
                    <span className="text-[9px] text-rose-455 font-semibold mt-1">
                      Failed to send.
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Message Input Footer */}
        <footer className="p-6 border-t border-slate-900 bg-slate-950 shrink-0 z-10">
          <form onSubmit={handleSendMessage} className="relative flex items-center">
            <input
              type="text"
              required
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={`Message #${room.name}`}
              className="w-full bg-slate-900/40 border border-slate-850 rounded-xl pl-4 pr-16 py-3.5 text-xs focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/30 transition-all duration-200"
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="absolute right-2 px-4 py-2 bg-indigo-650 hover:bg-indigo-600 disabled:bg-slate-900 disabled:text-slate-600 text-white text-[10px] font-bold rounded-lg transition-all duration-150"
            >
              Send
            </button>
          </form>
        </footer>
      </main>
    </div>
  );
}
