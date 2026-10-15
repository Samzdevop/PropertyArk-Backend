import { NextFunction, Request, Response } from "express";
import { sendSuccessResponse } from "../utils/sendSuccessResponse";
import { ContactService } from "../services/contact.service";
import { logActivity } from "./activity.controller";
import { ForbiddenError } from "../errors/ForbiddenError";
import { Role, ContactStatus } from "@prisma/client";

export const createContact = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { fullName, email, subject, message } = req.body;

    const contact = await ContactService.createContact({
      fullName,
      email,
      subject,
      message,
    });

    await logActivity(
      'anonymous',
      'CREATE_CONTACT',
      'CONTACT',
      contact.id,
      { contactNumber: contact.contactNumber, subject },
      req
    );

    sendSuccessResponse(
      res,
      "Your message has been sent. We'll get back to you shortly.",
      { contact: { contactNumber: contact.contactNumber } },
      201
    );
  } catch (error) {
    next(error);
  }
};

export const getAllContacts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can view contacts");
    }

    const { status, page = 1, limit = 20, search } = req.query;

    const result = await ContactService.getAllContacts({
      status: status as ContactStatus,
      page: Number(page),
      limit: Number(limit),
      search: search as string,
    });

    sendSuccessResponse(res, "Contacts retrieved successfully", result);
  } catch (error) {
    next(error);
  }
};

export const getContactById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { id } = req.params;

    const contact = await ContactService.getContactById(
      id as string,
      user.id,
      user.role
    );

    sendSuccessResponse(res, "Contact retrieved successfully", contact);
  } catch (error) {
    next(error);
  }
};

export const deleteContact = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenError("Only admins can delete contacts");
    }

    const { id } = req.params;

    await ContactService.deleteContact(id as string, user.id);

    await logActivity(
      user.id,
      'DELETE_CONTACT',
      'CONTACT',
      id as string,
      {},
      req
    );

    sendSuccessResponse(res, "Contact deleted successfully");
  } catch (error) {
    next(error);
  }
};