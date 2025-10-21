import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/user.model';
import ApiError from '../utils/apiError';
import logger from '../utils/logger';

interface TokenPayload {
  userId: string;
  role?: string;
}

export const login = async (email: string, password: string) => {
  console.log('Login attempt for email:', email);
  
  const user = await User.findOne({ email });
  console.log('User found:', user ? user.email : 'No user found');
  
  if (!user) {
    throw new ApiError(401, 'Invalid credentials');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'Account disabled');
  }

  // Debug password comparison
  console.log('Input password:', password);
  console.log('Stored hash:', user.password);
  
  const isPasswordValid = await bcrypt.compare(password, user.password);
  console.log('Password valid:', isPasswordValid);
  
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const accessToken = jwt.sign(
    { 
      userId: (user._id as mongoose.Types.ObjectId).toString(), 
      role: user.role 
    },
    process.env.JWT_SECRET!,
    { expiresIn: '1d' }
  );

  const refreshToken = jwt.sign(
    { userId: (user._id as mongoose.Types.ObjectId).toString() },
    process.env.REFRESH_TOKEN_SECRET!,
    { expiresIn: '7d' }
  );

  user.refreshToken = refreshToken;
  await user.save();

  const userResponse = {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    specialization: user.specialization
  };

  return {
    user: userResponse,
    accessToken,
    refreshToken
  };
};

export const logout = async (userId: string) => {
  await User.findByIdAndUpdate(userId, { refreshToken: null });
};

export const refresh = async (token: string) => {
  try {
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET!) as TokenPayload;
    const user = await User.findById(decoded.userId);

    if (!user || user.refreshToken !== token) {
      throw new ApiError(403, 'Invalid refresh token');
    }

    const accessToken = jwt.sign(
      { userId: (user._id as mongoose.Types.ObjectId).toString(), role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '1d' }
    );

    const refreshToken = jwt.sign(
      { userId: (user._id as mongoose.Types.ObjectId).toString() },
      process.env.REFRESH_TOKEN_SECRET!,
      { expiresIn: '7d' }
    );

    user.refreshToken = refreshToken;
    await user.save();

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(403, 'Invalid refresh token');
  }
};