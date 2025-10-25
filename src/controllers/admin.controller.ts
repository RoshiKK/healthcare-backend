import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/user.model';
import Appointment from '../models/appointment.model';
import Availability from '../models/availability.model';
import ApiResponse from '../utils/apiResponse';
import ApiError from '../utils/apiError';
import bcrypt from 'bcryptjs';

export const getAllDoctors = async (req: Request, res: Response) => {
  const { search, specialization, page = 1, limit = 10 } = req.query;
  
  const filter: any = { role: 'doctor' };
  
  if (search) {
    filter.$or = [
      { name: { $regex: search as string, $options: 'i' } },
      { email: { $regex: search as string, $options: 'i' } }
    ];
  }
  
  if (specialization) {
    filter.specialization = { $regex: specialization as string, $options: 'i' };
  }

  const options = {
    page: parseInt(page as string),
    limit: parseInt(limit as string),
    select: '-password -refreshToken',
    sort: { createdAt: -1 }
  };

  try {
    const doctors = await User.paginate(filter, options);
    return res.status(200).json(new ApiResponse(200, doctors));
  } catch (error) {
    console.error('Error fetching doctors:', error);
    throw new ApiError(500, 'Error fetching doctors');
  }
};

export const createDoctor = async (req: Request, res: Response) => {
  const { name, email, password, specialization } = req.body;
  
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new ApiError(400, 'Email already in use');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const doctor = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'doctor',
      specialization,
      isActive: true
    });

    const doctorData = {
      id: doctor._id,
      name: doctor.name,
      email: doctor.email,
      specialization: doctor.specialization,
      isActive: doctor.isActive
    };

    return res
      .status(201)
      .json(new ApiResponse(201, doctorData, 'Doctor created successfully'));
  } catch (error: unknown) {
    console.error('Error creating doctor:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Handle MongoDB duplicate key error
    if (error instanceof Error && error.message.includes('E11000')) {
      throw new ApiError(400, 'Email already in use');
    }
    
    throw new ApiError(500, 'Error creating doctor');
  }
};

export const updateDoctorStatus = async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const { isActive } = req.body;
  
  try {
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      throw new ApiError(400, 'Invalid doctor ID');
    }
    
    const doctor = await User.findByIdAndUpdate(
      doctorId,
      { isActive },
      { new: true }
    ).select('-password -refreshToken');

    if (!doctor) {
      throw new ApiError(404, 'Doctor not found');
    }

    return res.status(200).json(new ApiResponse(200, doctor, 'Doctor status updated'));
  } catch (error: unknown) {
    console.error('Error updating doctor status:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error updating doctor status');
  }
};

export const updateDoctor = async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const { name, email, password, specialization, isActive } = req.body;
  
  console.log('🔄 Update doctor request:', { doctorId, body: req.body });

  try {
    if (!doctorId || doctorId === 'undefined') {
      throw new ApiError(400, 'Doctor ID is required');
    }

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      throw new ApiError(400, 'Invalid doctor ID format');
    }

    const updateData: any = { 
      name, 
      email, 
      specialization, 
      isActive 
    };
    
    if (password && password.trim() !== '') {
      if (password.length < 6) {
        throw new ApiError(400, 'Password must be at least 6 characters long');
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.password = hashedPassword;
    }
    
    console.log('📝 Updating doctor with data:', updateData);
    
    const doctor = await User.findByIdAndUpdate(
      doctorId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password -refreshToken');

    if (!doctor) {
      throw new ApiError(404, 'Doctor not found');
    }

    const doctorData = {
      id: doctor._id.toString(),
      name: doctor.name,
      email: doctor.email,
      specialization: doctor.specialization,
      isActive: doctor.isActive,
      createdAt: doctor.createdAt,
      updatedAt: doctor.updatedAt
    };

    console.log('✅ Doctor updated successfully:', doctorData);
    return res.status(200).json(new ApiResponse(200, doctorData, 'Doctor updated successfully'));
  } catch (error: unknown) {
    console.error('❌ Error updating doctor:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    
    // Handle MongoDB duplicate key error
    if (error instanceof Error && error.message.includes('E11000')) {
      throw new ApiError(400, 'Email already in use');
    }
    
    throw new ApiError(500, 'Error updating doctor');
  }
};

export const deleteDoctor = async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  
  try {
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      throw new ApiError(400, 'Invalid doctor ID');
    }

    const doctor = await User.findByIdAndDelete(doctorId);
    
    if (!doctor) {
      throw new ApiError(404, 'Doctor not found');
    }

    await Promise.all([
      Appointment.deleteMany({ doctor: doctorId }),
      Availability.deleteMany({ doctor: doctorId })
    ]);

    return res.status(200).json(new ApiResponse(200, null, 'Doctor deleted successfully'));
  } catch (error: unknown) {
    console.error('Error deleting doctor:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error deleting doctor');
  }
};

export const getAdminStats = async (req: Request, res: Response) => {
  try {
    const [totalDoctors, activeDoctors, totalAppointments, recentAppointments] = await Promise.all([
      User.countDocuments({ role: 'doctor' }),
      User.countDocuments({ role: 'doctor', isActive: true }),
      Appointment.countDocuments(),
      Appointment.find().sort({ createdAt: -1 }).limit(5)
    ]);

    const specializations = await User.aggregate([
      { $match: { role: 'doctor' } },
      { $group: { _id: '$specialization', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    const stats = {
      totalDoctors,
      activeDoctors,
      totalAppointments,
      recentAppointments,
      topSpecializations: specializations
    };

    return res.status(200).json(new ApiResponse(200, stats));
  } catch (error: unknown) {
    console.error('Error fetching admin stats:', error);
    throw new ApiError(500, 'Error fetching admin stats');
  }
};