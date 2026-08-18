# Phase 4 — Socket.IO Infrastructure Architecture & Implementation Guide

This guide provides an exhaustive file-by-file and block-by-block breakdown of the Socket.IO real-time infrastructure implemented in Phase 4. It details the **Why (Rationale)**, **How (Implementation)**, and **Core Checkpoint Questions** for every component in our socket communications stack.

---

## 1. Socket Server Boot & Handshake Cookie Verification
* **File**: `backend/src/socket/index.ts`
* **Path**: [index.ts](file:///d:/Desktop/projects/OS_Discord/backend/src/socket/index.ts)

### **Why (Rationale)**
We authenticate connection requests at the handshake level instead of checking signatures on every event. This maximizes performance.
- The cookie header `socket.handshake.headers.cookie` is parsed using the `cookie` npm package (v2.0).
- The JWT is extracted, verified, and mapped using a strict Zod payload validator.
- The matching user is fetched from the database to guarantee the credentials are active.
- Verified identifiers are mounted onto `socket.data.userId` and `socket.data.user` for downstream access.

### **How (Code Block)**
```typescript
io.use(async (socket: Socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    if (!cookieHeader) return next(new Error('unauthorized'));

    const cookies = parseCookie(cookieHeader);
    const token = cookies.token;
    if (!token) return next(new Error('unauthorized'));

    const decoded = jwt.verify(token, env.JWT_SECRET);
    const parsed = tokenPayloadSchema.safeParse(decoded);
    if (!parsed.success) return next(new Error('unauthorized'));

    const user = await User.findById(parsed.data.userId);
    if (!user) return next(new Error('unauthorized'));

    socket.data.userId = user.id;
    socket.data.user = user;
    next();
  } catch (err: any) {
    logger.error({ err, socketId: socket.id }, 'Socket handshake failed');
    next(new Error('unauthorized'));
  }
});
```

### **Core Checkpoint Questions**
* **Q: Why verify authentication at connection handshake instead of on each event?**
  * **A**: Verifying a signature requires cryptographic CPU cycles, and querying the database to ensure the user is not deleted takes IO overhead. Doing this on every single real-time event would bottleneck the server. Handshake-only check is done once per socket lifecycle, which is highly scalable.
* **Q: Why wrap the handshake in try/catch and pass `next(new Error('unauthorized'))`?**
  * **A**: Throwing unhandled exceptions during Socket.IO middleware handshakes can cause client connections to hang or timeout cryptically. Invoking `next(new Error(...))` allows Socket.IO to reject the connection cleanly with a `connect_error` event client-side.

---

## 2. Dynamic Room Event Handlers
* **File**: `backend/src/socket/handlers/rooms.ts`
* **Path**: [rooms.ts](file:///d:/Desktop/projects/OS_Discord/backend/src/socket/handlers/rooms.ts)

### **Why (Rationale)**
Enforces per-event room authorization and manages join/leave logic.
- Implements `room:join` and `room:leave` events.
- Reuses `isRoomMember` from our database layer to prevent non-members from joining rooms.
- Employs **acknowledgments** (callbacks) for user-triggered operations to communicate success/failure back to the client.
- Uses `disconnecting` to broadcast leave actions before the rooms list is cleared from socket memory.

### **How (Code Block)**
```typescript
socket.on('room:join', async (payload: unknown, ack: unknown) => {
  const ackFn = typeof ack === 'function' ? ack : () => {};
  try {
    const parsed = z.object({ roomId: roomIdSchema }).safeParse(payload);
    if (!parsed.success) {
      return ackFn({ status: 'error', message: 'Invalid payload' });
    }
    const { roomId } = parsed.data;

    const isMember = await isRoomMember(roomId, userId);
    if (!isMember) {
      return ackFn({ status: 'error', message: 'Access denied: Not a member' });
    }

    await socket.join(roomId);
    socket.to(roomId).emit('user:joined', { userId, username, roomId });
    ackFn({ status: 'ok' });
  } catch (error: any) {
    socket.emit('error', { code: 'InternalError', message: 'Failed to join' });
    ackFn({ status: 'error', message: 'Internal server error' });
  }
});
```

### **Core Checkpoint Questions**
* **Q: What is the difference between `io.to(roomId).emit(...)` and `socket.to(roomId).emit(...)`?**
  * **A**: `io.to(...)` broadcasts to *everyone* in the room, including the sender. `socket.to(...)` broadcasts to everyone in the room *except* the sender. For events like `user:joined`, we use `socket.to` because the joiner does not need a broadcast stating they themselves joined.
* **Q: Why use `disconnecting` instead of `disconnect` to broadcast leave actions?**
  * **A**: At the moment of `disconnect`, the socket has already left all its rooms, and `socket.rooms` is empty. The `disconnecting` event fires *before* the socket leaves its rooms, allowing us to inspect `socket.rooms`, filter out the socket's own ID room, and broadcast `user:left` to the correct rooms.

---

## 3. Frontend Singleton Socket Context Provider
* **File**: `frontend/src/context/socket.tsx`
* **Path**: [socket.tsx](file:///d:/Desktop/projects/OS_Discord/frontend/src/context/socket.tsx)

### **Why (Rationale)**
Gains access to a single persistent socket instance, preventing duplicate connection leaks.
- Setup is gated behind `useAuth` session hydration to avoid unauthorized handshake attempts.
- Disconnects automatically if the user logs out.
- Exposes `socket` and connection state variables.

### **How (Code Block)**
```typescript
const newSocket = io(socketUrl, {
  withCredentials: true,
  autoConnect: false,
});
newSocket.connect();
setSocket(newSocket);
```

### **Core Checkpoint Questions**
* **Q: Why set `autoConnect: false` and explicitly call `connect()`?**
  * **A**: Setting `autoConnect: false` ensures the socket is not initialized before the component runs its setup verification checks. This prevents pre-login connection attempts.
* **Q: Why verify `authLoading` before connecting?**
  * **A**: Gating socket connections on auth hydration ensures the client has loaded its credentials from cookies, preventing immediate handshake rejections due to missing credentials.
