import { Request, Response } from 'express';
import User from '../models/user.model';
import Appointment from '../models/appointment.model';
import ApiResponse from '../utils/apiResponse';
import ApiError from '../utils/apiError';

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

  const doctors = await User.paginate(filter, options);

  return res.status(200).json(new ApiResponse(200, doctors));
};

export const createDoctor = async (req: Request, res: Response) => {
  const { name, email, password, specialization } = req.body;
  
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(400, 'Email already in use');
  }

  const doctor = await User.create({
    name,
    email,
    password,
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
};

export const updateDoctorStatus = async (req: Request, res: Response) => {
  const { doctorId } = req.params;
  const { isActive } = req.body;
  
  const doctor = await User.findByIdAndUpdate(
    doctorId,
    { isActive },
    { new: true }
  ).select('-password -refreshToken');

  if (!doctor) {
    throw new ApiError(404, 'Doctor not found');
  }

  return res.status(200).json(new ApiResponse(200, doctor, 'Doctor status updated'));
};

export const getAdminStats = async (req: Request, res: Response) => {
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
};