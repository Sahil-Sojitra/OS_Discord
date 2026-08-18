"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './auth';
import { env } from '@/config/env';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Wait until authentication status has hydrated
    if (authLoading) return;

    // Connect only if user is logged in
    if (!user) return;

    const socketUrl = env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    
    // Create singleton socket instance
    const newSocket = io(socketUrl, {
      withCredentials: true,
      autoConnect: false, // Wait until explicit connect call
    });

    newSocket.on('connect', () => {
      setConnected(true);
      console.log('[Socket] Connected successfully with ID:', newSocket.id);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      console.log('[Socket] Disconnected from server');
    });

    newSocket.on('connect_error', (err) => {
      setConnected(false);
      console.error('[Socket] Connection handshake error:', err.message);
    });

    // Start socket connection
    newSocket.connect();
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [user, authLoading]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
