import { Request, Response } from 'express';
import { login, logout, refresh } from '../services/auth.service';
import ApiResponse from '../utils/apiResponse';
import ApiError from '../utils/apiError';
import bcrypt from 'bcryptjs';
import User from '../models/user.model';

export const registerUser = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role = 'patient' } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new ApiError(400, 'User already exists with this email');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      isActive: true
    });

    // Remove password from response
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive
    };

    return res.status(201).json(new ApiResponse(201, userResponse, 'User registered successfully'));
  } catch (error: any) {
    console.error('Registration error:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, error.message || 'Error registering user');
  }
};

export const loginUser = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const { user, accessToken, refreshToken } = await login(email, password);

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  // FIXED: Return proper ApiResponse format
  return res.status(200).json(new ApiResponse(200, { 
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      specialization: user.specialization
    }, 
    accessToken 
  }));
};

export const logoutUser = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Not authenticated');
  }
  
  await logout(req.user.userId);
  res.clearCookie('refreshToken');
  return res.status(200).json(new ApiResponse(200, null, 'Logged out'));
};

export const refreshAccessToken = async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
  const result = await refresh(refreshToken);

  res.cookie('refreshToken', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  return res.status(200).json(new ApiResponse(200, { 
    accessToken: result.accessToken 
  }));
};