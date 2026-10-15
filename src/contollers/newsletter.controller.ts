import { NextFunction, Request, Response } from "express";
import { sendSuccessResponse } from "../utils/sendSuccessResponse";
import { NewsletterService } from "../services/newsletter.service";
import { logActivity } from "./activity.controller";
import { ForbiddenError } from "../errors/ForbiddenError";
import { Role } from "@prisma/client";

export const subscribe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email } = req.body;

    const subscriber = await NewsletterService.subscribe({ name, email });

    await logActivity(
      'anonymous',
      'NEWSLETTER_SUBSCRIBE',
      'NEWSLETTER',
      subscriber.id,
      { email },
      req
    );

    sendSuccessResponse(
      res,
      "Successfully subscribed! Check your email for confirmation.",
      { email: subscriber.email },
      201
    );
  } catch (error) {
    next(error);
  }
};

export const getAllSubscribers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can view subscribers");
    }

    const { isSubscribed, search, page = 1, limit = 20 } = req.query;

    const result = await NewsletterService.getAllSubscribers({
      isSubscribed: isSubscribed === 'true' ? true : isSubscribed === 'false' ? false : undefined,
      search: search as string,
      page: Number(page),
      limit: Number(limit),
    });

    sendSuccessResponse(res, "Subscribers retrieved successfully", result);
  } catch (error) {
    next(error);
  }
};


export const unsubscribeByToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token } = req.query;
    const { reason } = req.body;

    const result = await NewsletterService.unsubscribeByToken(
      token as string,
      reason
    );

    sendSuccessResponse(res, result.message, result);
  } catch (error) {
    next(error);
  }
};


export const unsubscribeByEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, reason } = req.body;

    const result = await NewsletterService.unsubscribeByEmail(email, reason);

    await logActivity(
      'anonymous',
      'NEWSLETTER_UNSUBSCRIBE',
      'NEWSLETTER',
      email,
      { email, reason },
      req
    );

    sendSuccessResponse(res, result.message, result);
  } catch (error) {
    next(error);
  }
};


export const deleteSubscriber = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can delete subscribers");
    }

    const { id } = req.params;

    await NewsletterService.deleteSubscriber(id as string, user.id);

    await logActivity(
      user.id,
      'DELETE_NEWSLETTER_SUBSCRIBER',
      'NEWSLETTER',
      id as string,
      {},
      req
    );

    sendSuccessResponse(res, "Subscriber deleted successfully");
  } catch (error) {
    next(error);
  }
};