# Phase 6 — Presence (Online Users per Room) Architecture & Implementation Guide

This guide provides an exhaustive file-by-file and block-by-block breakdown of the Presence module implemented in Phase 6. It details the **Why (Rationale)**, **How (Implementation)**, and **Core Checkpoint Questions** for every component in our in-memory connection and presence state mapping.

---

## 1. Backend In-Memory Presence Helpers
* **File**: `backend/src/socket/presence.ts`
* **Path**: [presence.ts](file:///d:/Desktop/projects/OS_Discord/backend/src/socket/presence.ts)

### **Why (Rationale)**
- **Ephemeral State**: Presence is temporary. Writing online states to MongoDB would generate heavy write traffic and result in stale records if the server crashes. By storing presence in Socket.IO's in-memory socket mappings, state is self-healing: if the process restarts, clients auto-reconnect and rebuild the presence lists in seconds.
- **Tab Deduplication**: Users might open the chat in multiple browser tabs, initiating multiple socket connections. We deduplicate the list by mapping active socket user IDs to a unique set (`Map<string, string>`) so that the user is counted once in the UI.

### **How (Code Block)**
```typescript
export const getRoomPresence = async (io: Server, roomId: string): Promise<PresenceUser[]> => {
  const sockets = await io.in(roomId).fetchSockets();
  
  const uniqueUsersMap = new Map<string, string>();
  for (const socket of sockets) {
    const userId = socket.data.userId;
    const username = socket.data.user?.username;
    if (userId && username) {
      uniqueUsersMap.set(userId, username);
    }
  }

  return Array.from(uniqueUsersMap.entries()).map(([userId, username]) => ({
    userId,
    username,
  }));
};
```
* **`fetchSockets()`**: Queries the internal Socket.IO adapter to retrieve all connected sockets in a room.
* **Deduplication**: The `uniqueUsersMap` ensures that if a user has 3 socket connections in the room, they are stored only once under their `userId`.

---

## 2. Join & Leave Event Handlers with Presence Checks
* **File**: `backend/src/socket/handlers/rooms.ts`
* **Path**: [rooms.ts](file:///d:/Desktop/projects/OS_Discord/backend/src/socket/handlers/rooms.ts)

### **Why (Rationale)**
- We only broadcast `user:joined` when the user's **first** socket joins a room.
- We only broadcast `user:left` when the user's **last** socket disconnects or leaves the room.
- This prevents notification spam when opening or closing multiple browser tabs.

### **How (Join Check)**
```typescript
await socket.join(roomId);
const isFirst = await isUserFirstSocketInRoom(io, roomId, userId);
if (isFirst) {
  socket.to(roomId).emit('user:joined', { userId, username, roomId });
}
const presence = await getRoomPresence(io, roomId);
ackFn({ status: 'ok', presence });
```
1. **Join Room**: We add the socket to the room first.
2. **First Socket Check**: We query active sockets. If the count is exactly `1`, this is their first connection, so we broadcast the join event.
3. **Presence Payload**: We include the full list of online users in the acknowledgment response, letting the client render the online list in a single network roundtrip.

### **How (Disconnect Check)**
```typescript
socket.on('disconnecting', async () => {
  const rooms = Array.from(socket.rooms).filter((roomId) => roomId !== socket.id);
  for (const roomId of rooms) {
    await socket.leave(roomId); // Remove this socket first

    const isLast = await isUserLastSocketInRoom(io, roomId, userId);
    if (isLast) {
      socket.to(roomId).emit('user:left', { userId, username, roomId });
    }
  }
});
```
1. **`disconnecting` Event**: Fires *before* the socket is destroyed, allowing us to inspect `socket.rooms`.
2. **Explicit Leave**: We call `await socket.leave(roomId)` to remove the disconnecting socket first.
3. **Last Socket Check**: We then check if any other sockets for this user remain in the room. If none remain, we broadcast the departure.

---

## 3. Frontend Presence Syncher
* **File**: `frontend/src/app/rooms/[roomId]/page.tsx`
* **Path**: [page.tsx](file:///d:/Desktop/projects/OS_Discord/frontend/src/app/rooms/%5BroomId%5D/page.tsx)

### **Why (Rationale)**
The client keeps a local list of active users (`presenceList`) synced in real time. It marks members in the sidebar with a green indicator dot if they exist in this list.

### **How (Code Block)**
```typescript
socket.on('user:joined', (data) => {
  setPresenceList((prev) => {
    if (prev.some((u) => u.userId === data.userId)) return prev;
    return [...prev, { userId: data.userId, username: data.username }];
  });
});
```

---

## 4. Core Checkpoint Questions for Interviews
* **Q: Why is presence kept in-memory instead of persisting to MongoDB?**
  * **A**: Scaling and reliability. If the backend process crashes or restarts, all client connections drop. If we saved presence in a database, we would have stale "online" records that require complex cleanup scripts. With in-memory storage, presence is self-healing: once the server boots back up, clients reconnect and rebuild the presence state instantly.
* **Q: Why call `socket.leave` inside the `disconnecting` handler?**
  * **A**: When checking if a user's connection was the last active one (`isUserLastSocketInRoom`), we must remove the current socket first. If we didn't remove it before checking, `fetchSockets()` would still count the disconnecting socket, preventing the `user:left` event from ever firing.
* **Q: Why verify `user:joined` with `isUserFirstSocketInRoom`?**
  * **A**: Deduplication. If a user opens the room in a new browser tab, they establish a new socket connection. We only want to announce their arrival to the rest of the room once, not for every tab they open.
