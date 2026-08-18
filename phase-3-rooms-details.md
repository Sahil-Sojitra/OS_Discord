# Phase 3 — Rooms Architecture & Implementation Guide

This guide provides an exhaustive file-by-file and block-by-block breakdown of the Rooms module implemented in Phase 3. It details the **Why (Rationale)**, **How (Implementation)**, and **Core Checkpoint Questions** for every component in our room management stack.

---

## 1. Room Database Model
* **File**: `backend/src/modules/rooms/models/room.ts`
* **Path**: [room.ts](file:///d:/Desktop/projects/OS_Discord/backend/src/modules/rooms/models/room.ts)

### **Why (Rationale)**
Rooms need metadata and access controls.
- We reference `createdBy` to map room ownership.
- We index the `members` array to accelerate searches for "rooms this user is a member of."
- **Security Checkpoint**: We must NEVER leak the `passwordHash` in API responses. Schema-level JSON transforms remove `passwordHash` and map the list size to a lightweight `memberCount`.

### **How (Code Block)**
```typescript
const roomSchema = new Schema<IRoom>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        const docObj = ret as any;
        delete docObj.passwordHash;
        delete docObj.__v;
        if (docObj.members) {
          docObj.memberCount = docObj.members.length;
        }
        return docObj;
      },
    },
  }
);
roomSchema.index({ members: 1 });
```
* **`members: [{ type: ObjectId, ref: 'User' }]`**: Declares an array of user references.
* **`roomSchema.index({ members: 1 })`**: Emits a database index. Without this, queries searching user memberships would do full collection scans.
* **`toJSON` transform**: Calculates `memberCount` dynamically, preventing the need to fetch all member details during simple list queries.

### **Core Checkpoint Questions**
* **Q: Why does the JSON transform delete `passwordHash`?**
  * **A**: To prevent critical password leaks. Whenever the server serializes a room document into a JSON payload for the frontend, it removes the bcrypt hash.
* **Q: Why index the `members` array?**
  * **A**: A user will query `rooms/mine` on every dashboard refresh. The index allows MongoDB to fetch matching rooms instantly without scanning the entire collection.

---

## 2. Rooms Validation Schemas
* **File**: `backend/src/modules/rooms/validators.ts`
* **Path**: [validators.ts](file:///d:/Desktop/projects/OS_Discord/backend/src/modules/rooms/validators.ts)

### **Why (Rationale)**
Validates boundary values (name lengths and passwords) for room actions before hitting services or databases.

### **How (Code Block)**
```typescript
export const createRoomSchema = z.object({
  name: z
    .string({ required_error: 'Room name is required' })
    .trim()
    .min(1, 'Room name cannot be empty')
    .max(30, 'Room name must be at most 30 characters'),
  password: z
    .string({ required_error: 'Room password is required' })
    .min(4, 'Room password must be at least 4 characters')
    .max(50, 'Room password is too long'),
});
```
* **`min(1)` / `max(30)`**: Rejects empty strings and sets a max length of 30 characters to keep lists readable in the UI.
* **`min(4)`**: Enforces a minimum password length of 4 characters for security.

---

## 3. Rooms Service Layer
* **File**: `backend/src/modules/rooms/room.service.ts`
* **Path**: [room.service.ts](file:///d:/Desktop/projects/OS_Discord/backend/src/modules/rooms/room.service.ts)

### **Why (Rationale)**
Encapsulates room logic: creation, password hashing, and membership queries.
- Room passwords are hashed using `bcrypt` (rounds = `10`).
- **Idempotency**: Re-joining an active membership is a no-op success (`200`) instead of throwing an error.

### **How (Code Block)**
```typescript
export const joinRoom = async (userId: string, roomId: string, password: string): Promise<void> => {
  const room = await Room.findById(roomId);
  if (!room) {
    throw new NotFoundError('Room not found');
  }

  const alreadyMember = room.members.some((memberId) => memberId.toString() === userId);
  if (alreadyMember) {
    return;
  }

  const isPasswordValid = await bcrypt.compare(password, room.passwordHash);
  if (!isPasswordValid) {
    throw new UnauthorizedError('Invalid room password');
  }

  await Room.findByIdAndUpdate(roomId, {
    $addToSet: { members: userId },
  });
};
```
* **`alreadyMember` check**: Returns success immediately if the user is already in `members`, preventing unnecessary processing.
* **`bcrypt.compare`**: Compares the entered password with the stored hash, throwing `UnauthorizedError` (401) on failure.
* **`$addToSet`**: Updates the array atomically, preventing duplicate IDs.

### **Core Checkpoint Questions**
* **Q: Why does `getMyRooms` exclude the `members` array?**
  * **A**: Performance. Returning the full members list for every room a user is in would create heavy payload overhead. The list view only needs a member count.
* **Q: Why does `joinRoom` throw a 401 instead of a 403 on password failure?**
  * **A**: By standard conventions, `403` signifies "The user is authenticated, but does not have permission to access the resource." A wrong password means room authentication failed, which is represented by `401 Unauthorized`.

---

## 4. requireRoomMember Middleware
* **File**: `backend/src/middleware/room.middleware.ts`
* **Path**: [room.middleware.ts](file:///d:/Desktop/projects/OS_Discord/backend/src/middleware/room.middleware.ts)

### **Why (Rationale)**
Protects dynamic room views.
- **Security Checkpoint**: If a user is not a member of a room, the middleware throws `404 Not Found` rather than `403 Forbidden` to hide the room's existence.

### **How (Code Block)**
```typescript
export const requireRoomMember = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const roomId = req.params.roomId;
    const userId = req.user?._id?.toString();
    ...
    const isMember = await isRoomMember(roomId, userId);
    if (!isMember) {
      throw new NotFoundError('Room not found');
    }

    const room = await getRoomById(roomId);
    req.room = room;
    next();
  } catch (error: any) {
    if (error?.name === 'CastError') {
      next(new NotFoundError('Room not found'));
      return;
    }
    next(error);
  }
};
```
* **`isRoomMember` check**: Verifies membership. If it returns false, it throws a `NotFoundError` (404).
* **`CastError` catch**: Catches invalid Mongoose ObjectId formats and returns a `404` instead of a `500` server crash.

---

## 5. Rooms Controllers
* **File**: `backend/src/modules/rooms/room.controller.ts`
* **Path**: [room.controller.ts](file:///d:/Desktop/projects/OS_Discord/backend/src/modules/rooms/room.controller.ts)

### **Why (Rationale)**
Translates Express requests to service calls. Since the `requireRoomMember` middleware already fetches room details and attaches them to `req.room`, `getDetail` can return `req.room` directly, saving a database query.

---

## 6. Rooms Router & Server Mounting
* **Files**: `backend/src/modules/rooms/room.routes.ts` & `backend/src/index.ts`
* **Paths**: [room.routes.ts](file:///d:/Desktop/projects/OS_Discord/backend/src/modules/rooms/room.routes.ts) & [index.ts](file:///d:/Desktop/projects/OS_Discord/backend/src/index.ts)

### **Why (Rationale)**
Binds HTTP routes. Enforces rate-limiting on room creation to block automated abuse (10 rooms per hour).

---

## 7. Frontend - Dynamic Room Detail Page
* **File**: `frontend/src/app/rooms/[roomId]/page.tsx`
* **Path**: [page.tsx](file:///d:/Desktop/projects/OS_Discord/frontend/src/app/rooms/%5BroomId%5D/page.tsx)

### **Why (Rationale)**
Fetches detailed room info. If the backend returns a 404, the user is redirected to `/rooms/[roomId]/join` to enter the room password.

### **How (Code Block)**
```typescript
const res = await apiFetch(`/rooms/${roomId}`);
if (res.status === 404) {
  router.push(`/rooms/${roomId}/join`);
  return;
}
```
* Handles the redirect seamlessly in the background, guiding users to the password form.

---

## 8. Frontend - Room Password Join Form
* **File**: `frontend/src/app/rooms/[roomId]/join/page.tsx`
* **Path**: [page.tsx](file:///d:/Desktop/projects/OS_Discord/frontend/src/app/rooms/%5BroomId%5D/join/page.tsx)

### **Why (Rationale)**
Prompts the user to enter the room password, sends a join POST, and redirects them to the room view upon success.
