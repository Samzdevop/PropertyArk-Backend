import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { sendSuccessResponse } from '../utils/sendSuccessResponse';
import { BadRequestError } from '../errors/BadRequestError';
import { NotFoundError } from '../errors/NotFoundError';
import { ForbiddenError } from '../errors/ForbiddenError';
import { userSelect } from '../prisma/selects';
import { deleteFile, getFileUrl } from '../config/upload';
import { NotificationHelpers } from '../helpers/notification.helpers';



export const createTask = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, description, priority, dueDate, assignedToId, livestockId } = req.body;
    const assignedById = (req.user as any).id;
    const assignedByRole = (req.user as any).role;

    // Check if assignee exists
    const assignee = await prisma.user.findUnique({
      where: { id: assignedToId },
      select: { role: true }
    });

    if (!assignee) {
      throw new NotFoundError('Assignee not found');
    }

    // // Validate assignment permissions
    // if (assignedByRole === 'FARM_KEEPER' && assignee.role !==  'COWORKER') {
    //   throw new ForbiddenError('Farm keepers can only assign tasks to coworkers');
    // }

    // if (assignedByRole === 'ADMIN' && !['FARM_KEEPER', 'COWORKER'].includes(assignee.role)) {
    //   throw new ForbiddenError('Admins can only assign tasks to farm keepers or coworkers');
    // }

    switch (assignedByRole) {
      case 'FARM_KEEPER':
        if (!['COWORKER', 'VET'].includes(assignee.role)) {
          throw new ForbiddenError('Farm keepers can only assign tasks to coworkers or vets');
        }
        break;
      case 'ADMIN':
        if (!['FARM_KEEPER', 'COWORKER', 'VET'].includes(assignee.role)) {
          throw new ForbiddenError('Admins can only assign tasks to farm keepers, coworkers, or vets');
        }
        break;
      default:
        throw new ForbiddenError('You do not have permission to assign tasks');
    }

    if (livestockId) {
      const livestock = await prisma.livestock.findUnique({
        where: { 
          id: livestockId,
          isDeleted: false 
        }
      });

      if (!livestock) {
        throw new NotFoundError('Livestock not found or has been deleted');
      }
    }

    const task = await prisma.task.create({
      data: {
        name,
        description,
        priority,
        dueDate: new Date(dueDate),
        status: 'PENDING',
        assignedToId,
        assignedById,
        livestockId: livestockId || null, 
      },
      include: {
        assignedTo: { select: userSelect },
        assignedBy: { select: userSelect },
        livestock: { select: userSelect },
      }
    });

    await NotificationHelpers.createTaskAssignmentNotification(task, task.assignedTo);

    sendSuccessResponse(res, 'Task created successfully', { task }, 201);
  } catch (error) {
    next(error);
  }
};

export const getMyTasks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req.user as any).id;
    const { status, page = 1, limit = 10 } = req.query;

    const where = {
      assignedToId: userId, 
      ...(status && { status: status as any })
    };

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { dueDate: 'asc' },
        include: {
          assignedBy: { 
            select: {
              id: true,
              fullName: true,
              role: true,
              companyName: true
            } 
          },
          livestock: true
        }
      }),
      prisma.task.count({ where })
    ]);

    sendSuccessResponse(res, 'Tasks retrieved successfully', {
      tasks,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getTask = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const taskId = req.params.taskId;

    const task = await prisma.task.findUnique({
      where: {
        id: taskId,
      },
      include: {
        assignedBy: {select: userSelect },
        assignedTo: { select: userSelect },
        livestock: true,
        }
    });

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    sendSuccessResponse(res, 'Task retrieved successfully', { task });
  } catch (error) {
    next(error);
  }
};

export const updateTaskStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status } = req.body;
    const taskId = req.params.taskId;
    const userId = (req.user as any).id;

    // Verify task exists and belongs to user
    const task = await prisma.task.findUnique({
      where: { id: taskId }
    });

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    if (task.assignedToId !== userId) {
      throw new ForbiddenError('You can only update your own tasks');
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: { status },
      include: {
        assignedTo: { select: userSelect },
        assignedBy: { select: userSelect }
      }
    });

    sendSuccessResponse(res, 'Task status updated successfully', { task: updatedTask });
  } catch (error) {
    next(error);
  }
};

export const getAllAssignedTasks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req.user as any).id;
    const userRole = (req.user as any).role;
    const { status, page = 1, limit = 10 } = req.query;
    const where: any = {
      ...(status && { status: status as string })
    };

    // Role-specific filtering
    // if (userRole === 'FARM_KEEPER') {
    //   // Farm keepers can only see tasks they've assigned or tasks assigned to their coworkers
    //   where.OR = [
    //     { assignedById: userId },
    //     { 
    //       assignedTo: { 
    //         role:{ in: ['COWORKER', 'VET'] },
    //       } 
    //     }
    //   ];
    // } 
    switch (userRole) {
      case 'FARM_KEEPER':
        where.OR = [
          { assignedById: userId },
          { 
            assignedTo: { 
              role: { in: ['COWORKER', 'VET'] }
            } 
          }
        ];
        break;
      
      case 'ADMIN':
        // Admin can see all tasks (no additional filtering needed)
        break;
      
      case 'VET':
          where.assignedToId = userId;
        break;
      default:
        where.assignedToId = userId;
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { dueDate: 'asc' },
        include: {
          assignedTo: { 
            select: {
              id: true,
              fullName: true,
              role: true
            } 
          },
          assignedBy: { 
            select: {
              id: true,
              fullName: true,
              role: true
            } 
          },
          livestock: true
        }
      }),
      prisma.task.count({ where })
    ]);

    sendSuccessResponse(res, 'Assigned tasks retrieved successfully', {
      tasks,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};


export const createTaskObservation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { taskId } = req.params;
    const { note } = req.body;
    const userId = (req.user as any).id;
    const files = req.files as Express.Multer.File[];

    // Verify task exists and belongs to user
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        assignedToId: userId
      }
    });

    if (!task) {
      // Clean up uploaded files if task not found
      if (files) {
        await Promise.all(files.map(file => 
          deleteFile(file.filename)
        ));
      }
      throw new NotFoundError('Task not found or you are not assigned to it');
    }

    // Process file URLs
    const mediaUrls = files?.map(file => getFileUrl(file.filename)) || [];

    // Create the observation
    const observation = await prisma.taskObservation.create({
      data: {
        note,
        mediaUrls,
        taskId,
        reportedById: userId,
        reportedAt: new Date()
      },
      include: {
        reportedBy: { select: userSelect }
      }
    });

    sendSuccessResponse(
      res,
      'Task observation reported successfully',
      { observation },
      201
    );
  } catch (error) {
    // Clean up files if error occurs
    if (req.files) {
      await Promise.all(
        (req.files as Express.Multer.File[]).map(file => 
          deleteFile(file.filename)
        )
      );
    }
    next(error);
  }
};


export const getTasksByLivestock = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { livestockId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Verify livestock exists
    const livestock = await prisma.livestock.findUnique({
      where: { 
        id: livestockId,
        isDeleted: false 
      }
    });

    if (!livestock) {
      throw new NotFoundError('Livestock not found');
    }

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where: { livestockId },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { dueDate: 'asc' },
        include: {
          assignedBy: { 
            select: {
              id: true,
              fullName: true,
              role: true,
              companyName: true,
              email: true
            } 
          },
          assignedTo: { 
            select: {
              id: true,
              fullName: true,
              role: true,
              companyName: true,
              email: true
            } 
          },
          observations: {
            orderBy: { reportedAt: 'desc' },
            take: 1
          }
        }
      }),
      prisma.task.count({ where: { livestockId } })
    ]);

    sendSuccessResponse(res, 'Livestock tasks retrieved successfully', {
      tasks,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};