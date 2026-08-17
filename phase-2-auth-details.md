# Phase 2 — Authentication Architecture & Implementation Guide

This guide provides an exhaustive file-by-file and block-by-block breakdown of the Authentication system implemented in Phase 2. It details the **Why (Rationale)**, **How (Implementation)**, and **Core Checkpoint Questions** for every component in our authentication stack.

---

## 1. Environment Variable Validation
* **File**: `backend/src/config/env.ts`
* **Path**: [env.ts](file:///d:/Desktop/projects/OS_Discord/backend/src/config/env.ts)

### **Why (Rationale)**
The cryptography signature of JSON Web Tokens (JWT) depends entirely on `JWT_SECRET`. If a server starts up without a secret, it cannot secure session validation. We add `JWT_SECRET` to the Zod schema on boot so that the server crashes loudly and instantly if it's missing, avoiding silent failures.

### **How (Code Block)**
```typescript
const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGO_URI: z.string({ required_error: 'MONGO_URI is required' }),
  FRONTEND_URL: z.string({ required_error: 'FRONTEND_URL is required' }),
  JWT_SECRET: z.string({ required_error: 'JWT_SECRET is required' }),
});
```
* **`z.string({ required_error: '...' })`**: Mandates a string. If the `.env` file does not define `JWT_SECRET`, validation fails.
* **`process.exit(1)`**: Halts execution instantly, printing the missing keys to console stderr.

### **Core Checkpoint Questions**
* **Q: How does this prevent runtime security issues?**
  * **A**: By ensuring the application never boots in an unconfigured, insecure state where secrets are missing or fall back to weak defaults (like an empty string).
* **Q: How can we verify the crash?**
  * **A**: Remove or rename `JWT_SECRET` in `backend/.env` and run `npm run dev`. The console should immediately output: `JWT_SECRET is required` and exit.

---

## 2. User Database Model
* **File**: `backend/src/modules/auth/models/user.ts`
* **Path**: [user.ts](file:///d:/Desktop/projects/OS_Discord/backend/src/modules/auth/models/user.ts)

### **Why (Rationale)**
Users need a unique login identity. We index and lowercase the `username` to enforce uniqueness and prevent user duplication through casing differences. We also enforce schema-level output sanitization to ensure `passwordHash` is never leaked over the wire.

### **How (Code Block)**
```typescript
const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform: (_doc, ret) => {
        const docObj = ret as any;
        delete docObj.passwordHash;
        delete docObj.__v;
        return docObj;
      },
    },
  }
);
```
* **`unique: true` / `index: true`**: Creates a unique index in MongoDB, protecting database integrity.
* **`lowercase: true` / `trim: true`**: Normalizes input.
* **`toJSON` transform**: Automatically runs when Express calls `res.json(user)`. It strips `passwordHash` and `__v` from the output object.

### **Core Checkpoint Questions**
* **Q: Why rely on the unique database index instead of performing `findOne` then `create`?**
  * **A**: It prevents **TOCTOU (Time-of-Check to Time-of-Use)** race conditions. If two users request registration for the same username at the exact same millisecond, concurrent `findOne` calls might both report the name is free. Delegating collision detection to MongoDB's unique index locks and catching the duplicate key error prevents duplicates.

---

## 3. Custom Error Definitions
* **File**: `backend/src/utils/errors.ts`
* **Path**: [errors.ts](file:///d:/Desktop/projects/OS_Discord/backend/src/utils/errors.ts)

### **Why (Rationale)**
To keep controllers thin, we decouple error payloads and status codes from request handling. Throwing semantic classes (like `UnauthorizedError`) ensures consistent JSON response envelopes.

### **How (Code Block)**
```typescript
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly details: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}
```
* **`Object.setPrototypeOf(this, new.target.prototype)`**: Standard TypeScript inheritance fix. Restores the prototype chain for subclass evaluations (e.g. `err instanceof AppError`) since compiling to ES5 or older runtimes breaks custom Error instances.

### **Core Checkpoint Questions**
* **Q: What is the benefit of having subclassed errors like `BadRequestError(400)` or `ConflictError(409)`?**
  * **A**: They supply preconfigured HTTP status codes and structure context details, keeping service and controller layers clean of response status management.

---

## 4. Central Error Handling Middleware
* **File**: `backend/src/middleware/error.ts`
* **Path**: [error.ts](file:///d:/Desktop/projects/OS_Discord/backend/src/middleware/error.ts)

### **Why (Rationale)**
Captures all unhandled exceptions globally. It maps structured Zod issues, custom application errors, and database duplicates to unified, client-friendly JSON envelopes: `{ error: { code, message, details } }`.

### **How (Code Block)**
```typescript
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.constructor.name,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }
  ...
```
* **`err instanceof AppError`**: Reads and returns custom error attributes.
* **`err instanceof ZodError`**: Maps input failures into a field-by-field array so the frontend can display inline error alerts.
* **`err.code === 11000`**: Maps MongoDB duplicate key conflicts to a client-friendly 400 response.

---

## 5. Generic Validation Middleware
* **File**: `backend/src/middleware/validation.ts`
* **Path**: [validation.ts](file:///d:/Desktop/projects/OS_Discord/backend/src/middleware/validation.ts)

### **Why (Rationale)**
Ensures controllers receive valid and formatted input. By executing validation in a reusable middleware layer, we keep routing chains modular.

### **How (Code Block)**
```typescript
export const validate = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.body);
      req.body = parsed;
      next();
    } catch (error) {
      next(error);
    }
  };
};
```
* **`req.body = parsed`**: Re-assigns the validated and coerced payload. Zod strips unmapped or malicious request parameters before they reach the controller.

---

## 6. Authentication Validation Schemas
* **File**: `backend/src/modules/auth/validators.ts`
* **Path**: [validators.ts](file:///d:/Desktop/projects/OS_Discord/backend/src/modules/auth/validators.ts)

### **Why (Rationale)**
Validates input limits early. It prevents malicious usernames (e.g. script tags) or short, insecure passwords from hitting our database and hashing functions.

### **How (Code Block)**
```typescript
export const registerSchema = z.object({
  username: z
    .string({ required_error: 'Username is required' })
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain alphanumeric characters and underscores'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password is too long'),
});
```
* **Alphanumeric Regex**: Limits usernames to letters, numbers, and underscores to prevent injection attacks and ensure uniform paths.

---

## 7. Authentication Service Layer
* **File**: `backend/src/modules/auth/auth.service.ts`
* **Path**: [auth.service.ts](file:///d:/Desktop/projects/OS_Discord/backend/src/modules/auth/auth.service.ts)

### **Why (Rationale)**
Contains the cryptography calculations. Hashing algorithms like `bcrypt` are slow by design to hinder brute-force calculations. We set salt rounds to `12`.
We decode JWT signatures safely. We parse decoded payloads against a Zod schema instead of using type assertions (`as JWTPayload`) to prevent token forgery.

### **How (Code Block)**
```typescript
const jwtPayloadSchema = z.object({
  userId: z.string(),
});

export const verifyToken = (token: string): JWTPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const result = jwtPayloadSchema.safeParse(decoded);
    if (!result.success) {
      throw new UnauthorizedError('Invalid token structure');
    }
    return result.data;
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired authentication token');
  }
};
```
* **`jwt.verify`**: Cryptographically validates token authenticity using `JWT_SECRET`.
* **`jwtPayloadSchema.safeParse`**: Validates that the payload contains a valid `userId` string.

### **Core Checkpoint Questions**
* **Q: Why does the JWT payload contain ONLY `userId`?**
  * **A**: Minimizes token weight and prevents stale data. If metadata (e.g. username) was stored in the JWT, updates to user records would not reflect in active user sessions until their cookie expired. Storing only `userId` keeps the token lightweight and secure.

---

## 8. Authentication Controllers
* **File**: `backend/src/modules/auth/auth.controller.ts`
* **Path**: [auth.controller.ts](file:///d:/Desktop/projects/OS_Discord/backend/src/modules/auth/auth.controller.ts)

### **Why (Rationale)**
Translates Express requests to service calls. Mounts/unmounts HTTP-Only session cookies containing the signed JWT.

### **How (Code Block)**
```typescript
const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};
```
* **`httpOnly: true`**: Blocks client-side scripts from reading the cookie, mitigating XSS session hijacking.
* **`secure: env.NODE_ENV === 'production'`**: Instructs browsers to transmit cookies only over encrypted HTTPS connections in production.
* **`sameSite: 'lax'`**: Restricts cookie transmission on cross-origin requests to mitigate CSRF attacks.

---

## 9. RequireAuth Authorization Middleware
* **File**: `backend/src/middleware/auth.middleware.ts`
* **Path**: [auth.middleware.ts](file:///d:/Desktop/projects/OS_Discord/backend/src/middleware/auth.middleware.ts)

### **Why (Rationale)**
Guards routes requiring authorization. It reads session cookies, decrypts tokens, fetches fresh user details from the database, and mounts the user onto `req.user`.

### **How (Code Block)**
```typescript
export const requireAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.cookies?.token;
    if (!token) {
      throw new UnauthorizedError('Access denied: No session token provided');
    }

    const { userId } = verifyToken(token);
    const user = await User.findById(userId);
    if (!user) {
      throw new UnauthorizedError('Access denied: User session invalid');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
```
* **Fresh DB Query**: Fetching the user from the database on every request prevents issues with stale sessions. If a user's account is deactivated or updated, the change applies immediately.

---

## 10. Auth Router and Rate Limiter
* **File**: `backend/src/modules/auth/auth.routes.ts`
* **Path**: [auth.routes.ts](file:///d:/Desktop/projects/OS_Discord/backend/src/modules/auth/auth.routes.ts)

### **Why (Rationale)**
Maps routers. We enforce rate-limiting on login and registration requests to block automated brute-force attacks.

### **How (Code Block)**
```typescript
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 5, // 5 requests max
  message: {
    error: {
      code: 'TooManyRequestsError',
      message: 'Too many attempts. Please try again in 15 minutes.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
```
* **IP Limiter**: Tracks request frequencies per client IP. If a client sends more than 5 authentication requests within 15 minutes, the server responds with a 429 status code.

---

## 11. Root Server Bootstrapper
* **File**: `backend/src/index.ts`
* **Path**: [index.ts](file:///d:/Desktop/projects/OS_Discord/backend/src/index.ts)

### **Why (Rationale)**
Initializes middleware, binds routers, and starts the server. Registers `cookie-parser` to parse cookies for auth middleware.

### **How (Code Block)**
```typescript
app.use(express.json());
app.use(cookieParser());

// Authentication routes
app.use('/auth', authRouter);
```
* **Order of Middleware**: `cookieParser` is registered before `authRouter` so that cookies are parsed before authentication routes process requests.

---

## 12. Frontend - Auth Context Provider
* **File**: `frontend/src/context/auth.tsx`
* **Path**: [auth.tsx](file:///d:/Desktop/projects/OS_Discord/frontend/src/context/auth.tsx)

### **Why (Rationale)**
Manages global session state across the Next.js frontend application.
- Fetches `/auth/me` on boot to restore active user sessions.
- **Visual Glitch Protection**: Blocks rendering children until the initial loading state resolves, preventing unauthenticated layouts from flashing.

### **How (Code Block)**
```typescript
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  ...
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center ...">
        <div className="w-12 h-12 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin" />
        ...
      </div>
    );
  }
```
- **Loader**: Renders a loading splash screen during initial hydration, providing a clean user experience.

---

## 13. Frontend - Login Screen
* **File**: `frontend/src/app/login/page.tsx`
* **Path**: [page.tsx](file:///d:/Desktop/projects/OS_Discord/frontend/src/app/login/page.tsx)

### **Why (Rationale)**
Provides a secure login screen. Communicates with our `useAuth` hook and handles inline submission error messages.

### **How (Code Block)**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);
  setLoading(true);
  try {
    await login(username, password);
  } catch (err: unknown) {
    setError(err instanceof Error ? err.message : 'Failed to login');
    setLoading(false);
  }
};
```
* Displays detailed error blocks returned by the backend (such as validation failures or rate limit alerts) to guide users.

---

## 14. Frontend - Registration Screen
* **File**: `frontend/src/app/register/page.tsx`
* **Path**: [page.tsx](file:///d:/Desktop/projects/OS_Discord/frontend/src/app/register/page.tsx)

### **Why (Rationale)**
Provides a registration form similar to the login screen, with descriptions detailing constraints like username formatting rules.

---

## 15. Frontend - Dashboard Session Home
* **File**: `frontend/src/app/page.tsx`
* **Path**: [page.tsx](file:///d:/Desktop/projects/OS_Discord/frontend/src/app/page.tsx)

### **Why (Rationale)**
If authenticated, shows user profile metrics and logout options. If unauthenticated, displays registration and login landing links.
