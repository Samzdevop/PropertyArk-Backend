import { Router } from 'express';

import { 
  createTask, 
  createTaskObservation, 
  getAllAssignedTasks, 
  getMyTasks, 
  getTask, 
  updateTaskStatus 
} from '../contollers/task.controller';
import { authenticateJWT } from '../middlewares/errorHandler';
import { requireRoles } from '../middlewares/roleCheck';
import { validateRequest } from '../middlewares/validateRequest';
import { createTaskObservationSchema, createTaskSchema, updateTaskStatusSchema } from '../schemas/task.schemas';
import { upload } from '../config/upload';

const router = Router();

router.post(
  '/',
  authenticateJWT,
  requireRoles(['ADMIN', 'FARM_KEEPER']),
  validateRequest(createTaskSchema),
  createTask
  
);

router.post(
  '/:taskId/observations',
  authenticateJWT,
  upload.array('media', 5), // Max 5 files
  validateRequest(createTaskObservationSchema),
  createTaskObservation
);

router.get(
  '/my-tasks',
  authenticateJWT,
  getMyTasks
);

router.get(
  '/:taskId',
  authenticateJWT,
  getTask
);

router.patch(
  '/:taskId/status',
  authenticateJWT,
  validateRequest(updateTaskStatusSchema),
  updateTaskStatus
);

router.get(
  '/assigned/all',
  authenticateJWT,
  requireRoles(['ADMIN', 'FARM_KEEPER', ]),
  getAllAssignedTasks
);

export const taskRouter = router;