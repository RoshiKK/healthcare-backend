import { Document } from 'mongoose';

export type UserRole = 'admin' | 'doctor' | 'patient';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  specialization?: string;
  isActive: boolean;
  refreshToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    specialization?: string;
  };
  tokens: AuthTokens;
}

export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  specialization?: string;
}