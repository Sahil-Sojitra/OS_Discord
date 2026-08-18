# Phase 5 — Messaging (Send + List + Persist) Architecture & Implementation Guide

This guide provides an exhaustive file-by-file and block-by-block breakdown of the Messaging module implemented in Phase 5. It details the **Why (Rationale)**, **How (Implementation)**, and **Core Checkpoint Questions** for every component in our message storage, socket propagation, and pagination stack.

---

## 1. Message Database Model
* **File**: `backend/src/modules/messages/models/message.ts`
* **Path**: [message.ts](file:///d:/Desktop/projects/OS_Discord/backend/src/modules/messages/models/message.ts)

### **Why (Rationale)**
- We define references to the `Room` and `User` models to link messages.
- **Performance**: A compound index `{ roomId: 1, _id: -1 }` is applied. In MongoDB, `_id` encodes creation timestamps. Querying messages in a specific room sorted by reverse chronology (newest first) will utilize this index, turning collection scans into O(log N) operations.

### **How (Code Block)**
```typescript
const messageSchema = new Schema<IMessage>(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);
messageSchema.index({ roomId: 1, _id: -1 });
```

---

## 2. Cursor Pagination REST Endpoint
* **File**: `backend/src/modules/messages/message.controller.ts` & `backend/src/modules/messages/message.service.ts`
* **Paths**: [message.controller.ts](file:///d:/Desktop/projects/OS_Discord/backend/src/modules/messages/message.controller.ts) & [message.service.ts](file:///d:/Desktop/projects/OS_Discord/backend/src/modules/messages/message.service.ts)

### **Why (Rationale)**
- Traditional offset pagination (`LIMIT X OFFSET Y`) suffers from the **duplicate/skip bug** in real-time applications. If new messages arrive while a user is paginating history, the offsets shift, causing the client to see duplicate messages.
- **Cursor Pagination** solves this. The cursor is the `_id` of the oldest message currently on the user's screen. The database queries for messages where `_id < cursor`, preventing any overlap regardless of how many new messages have arrived at the bottom of the feed.

### **How (Service Query)**
```typescript
const filter: any = { roomId };
if (query.before) {
  filter._id = { $lt: query.before };
}
const messages = await Message.find(filter)
  .sort({ _id: -1 })
  .limit(query.limit)
  .populate('senderId', 'username');
```
* **`$lt: query.before`**: Filters out messages created *after* (or equal to) the oldest message currently loaded on the screen.
* **`nextCursor`**: Calculated as the ID of the oldest message in the returned batch, or `null` if the returned length is less than the requested limit (indicating the end of history).

---

## 3. Real-Time Socket message:send Handler
* **File**: `backend/src/socket/handlers/messages.ts`
* **Path**: [messages.ts](file:///d:/Desktop/projects/OS_Discord/backend/src/socket/handlers/messages.ts)

### **Why (Rationale)**
- **Authentication & Authorization**: The user's identity is verified at handshake (`socket.data.userId`). When receiving `message:send`, the handler verifies if that user is currently a member of the target room (`isRoomMember`) before writing to the database, preventing spoofing.
- **UI Reconciliation (`tempId`)**: The server receives a client-generated `tempId` and echoes it back *only* inside the sender's acknowledgment callback, while the room-wide broadcast `message:new` carries only the database-generated message. This lets the sender replace their optimistic message without showing the temporary ID to other clients.

### **How (Code Block)**
```typescript
socket.on('message:send', async (payload: unknown, ack: unknown) => {
  const parsed = sendMessageSchema.safeParse(payload);
  ...
  const isMember = await isRoomMember(roomId, userId);
  if (!isMember) return ackFn({ status: 'error', message: 'Access denied' });

  const message = await messageService.createMessage(userId, roomId, content);

  // Broadcast to all sockets in the room
  io.to(roomId).emit('message:new', { message });

  // Acknowledge directly to sender, passing back the tempId
  ackFn({
    status: 'ok',
    tempId,
    message,
  });
});
```

---

## 4. Frontend Optimistic UI & Scroll Pinning
* **File**: `frontend/src/app/rooms/[roomId]/page.tsx`
* **Path**: [page.tsx](file:///d:/Desktop/projects/OS_Discord/frontend/src/app/rooms/%5BroomId%5D/page.tsx)

### **Why (Rationale)**
- **Optimistic UI**: When the user clicks Send, we don't wait for the server roundtrip. We immediately construct an optimistic message with a generated UUID (`tempId`) and append it to the state with a `sending` flag. When the server acknowledgment fires, we swap the temp message with the actual server database record.
- **Scroll Pinning (Keep scroll position on pagination)**: When loading older messages at the top of the chat, appending new elements changes the container's height, which would cause the scroll viewport to jump. We store the `scrollHeight` before fetching, and after the elements are prepended, we adjust the scroll position (`scrollTop = newHeight - oldHeight`) so the viewport remains stable.

### **How (Scroll Pin Code)**
```typescript
const container = messageContainerRef.current;
const prevScrollHeight = container.scrollHeight;

// Fetch and append ...
setMessages((prev) => [...reversedNewMessages, ...prev]);

// Pin scroll height
setTimeout(() => {
  container.scrollTop = container.scrollHeight - prevScrollHeight;
}, 0);
```

### **How (Reconciliation Code)**
```typescript
// Ignore own messages in socket listener to prevent duplicates
socket.on('message:new', (data) => {
  if (data.message.senderId.id === user.id) return;
  setMessages((prev) => [...prev, data.message]);
});
```

---

## 5. Core Checkpoint Questions for Interviews
* **Q: Why does the sender client ignore the broadcast `message:new` event?**
  * **A**: To avoid duplication. The sender's client handles its own message insertion using the acknowledgment callback from the `message:send` socket call. If it also processed the broadcast, the message would appear twice.
* **Q: How does scroll pinning work?**
  * **A**: By measuring `scrollHeight` before inserting elements at the top, and setting the container's `scrollTop` to the difference (`newScrollHeight - oldScrollHeight`) after elements are rendered, keeping the view locked in place.
