import mongoose, { Document, Schema } from 'mongoose';
import { UserRole } from '../interfaces/user.interface';
import mongoosePaginate from 'mongoose-paginate-v2';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId; // Add this line
  id: string; // Add this line
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

export const getUserId = (user: IUser): string => {
  return user.id || user._id?.toString() || '';
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'doctor', 'patient'], required: true },
    specialization: { type: String, required: function() { return this.role === 'doctor'; } },
    isActive: { type: Boolean, default: true },
    refreshToken: { type: String }
  },
  { timestamps: true }
);

userSchema.plugin(mongoosePaginate);

const User = mongoose.model<IUser, mongoose.PaginateModel<IUser>>('User', userSchema);
export default User;