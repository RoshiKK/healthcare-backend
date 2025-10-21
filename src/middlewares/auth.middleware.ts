import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/user.model";
import ApiError from "../utils/apiError";
import logger from "../utils/logger";
import mongoose from "mongoose";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: string;
      };
    }
  }
}

interface JwtPayload {
  userId: string;
  role: string;
}

export default async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];

    if (!token) {
      throw new ApiError(401, "Authentication token missing");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    const user = await User.findById(decoded.userId).select(
      "-password -refreshToken"
    );

    if (!user) {
      throw new ApiError(401, "User belonging to this token no longer exists");
    }

    if (!user.isActive) {
      throw new ApiError(403, "User account has been disabled");
    }

    req.user = {
      userId: (user._id as mongoose.Types.ObjectId).toString(),
      role: user.role,
    };

    next();
  } catch (error) {
    logger.error(`Authentication error: ${error}`);

    if (error instanceof jwt.TokenExpiredError) {
      return next(new ApiError(401, "Token expired"));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new ApiError(401, "Invalid token"));
    }

    next(error);
  }
}

export function roleMiddleware(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, "Not authenticated"));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(403, `You don't have permission to perform this action`)
      );
    }

    next();
  };
}

export const adminMiddleware = roleMiddleware(["admin"]);
export const doctorMiddleware = roleMiddleware(["doctor"]);
export const patientMiddleware = roleMiddleware(["patient"]);
