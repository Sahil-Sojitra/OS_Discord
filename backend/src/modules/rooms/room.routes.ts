import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as roomController from './room.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireRoomMember } from '../../middleware/room.middleware.js';
import { validate } from '../../middleware/validation.js';
import { createRoomSchema, joinRoomSchema } from './validators.js';

const router = Router();

// Apply a rate limiter specifically for creating rooms: 10 rooms per hour per IP
const roomCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    error: {
      code: 'TooManyRequestsError',
      message: 'Room creation limit reached. Please wait an hour before creating more rooms.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', requireAuth, roomCreationLimiter, validate(createRoomSchema), roomController.create);
router.post('/:roomId/join', requireAuth, validate(joinRoomSchema), roomController.join);
router.get('/mine', requireAuth, roomController.listMine);
router.get('/:roomId', requireAuth, requireRoomMember, roomController.getDetail);

export default router;
