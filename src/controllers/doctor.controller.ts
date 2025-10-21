'use client'

import { Request, Response } from 'express';
import User from '../models/user.model';
import ApiResponse from '../utils/apiResponse';
import ApiError from '../utils/apiError';

export const getAllDoctors = async (req: Request, res: Response) => {
  try {
    const { search, specialization } = req.query;
    
    console.log('GET /api/doctors called with query:', { search, specialization });
    
    const filter: any = { role: 'doctor', isActive: true };
    
    if (search && search !== '') {
      filter.$or = [
        { name: { $regex: search as string, $options: 'i' } },
        { email: { $regex: search as string, $options: 'i' } },
        { specialization: { $regex: search as string, $options: 'i' } }
      ];
    }
    
    if (specialization && specialization !== '' && specialization !== 'all') {
      filter.specialization = { $regex: specialization as string, $options: 'i' };
    }

    console.log('Database filter:', JSON.stringify(filter, null, 2));

    const doctors = await User.find(filter)
      .select('-password -refreshToken')
      .sort({ name: 1 })
      .lean(); // Use lean() for better performance

    console.log('Found doctors:', doctors.length);
    console.log('Doctor names:', doctors.map(d => d.name));

    // Transform the data to ensure consistent format
    const transformedDoctors = doctors.map(doctor => ({
      id: doctor._id.toString(),
      _id: doctor._id.toString(),
      name: doctor.name,
      email: doctor.email,
      role: doctor.role,
      specialization: doctor.specialization,
      isActive: doctor.isActive,
      createdAt: doctor.createdAt,
      updatedAt: doctor.updatedAt
    }));

    return res.status(200).json(new ApiResponse(200, transformedDoctors));
  } catch (error) {
    console.error('Error in getAllDoctors:', error);
    throw new ApiError(500, 'Error fetching doctors');
  }
};

export const getDoctorById = async (req: Request, res: Response) => {
  try {
    const { doctorId } = req.params;
    
    if (!doctorId) {
      return res.status(400).json(new ApiResponse(400, null, 'Doctor ID is required'));
    }

    const doctor = await User.findOne({
      _id: doctorId,
      role: 'doctor',
      isActive: true
    }).select('-password -refreshToken').lean();

    if (!doctor) {
      return res.status(404).json(new ApiResponse(404, null, 'Doctor not found'));
    }

    // Transform the data
    const transformedDoctor = {
      id: doctor._id.toString(),
      _id: doctor._id.toString(),
      name: doctor.name,
      email: doctor.email,
      role: doctor.role,
      specialization: doctor.specialization,
      isActive: doctor.isActive,
      createdAt: doctor.createdAt,
      updatedAt: doctor.updatedAt
    };

    return res.status(200).json(new ApiResponse(200, transformedDoctor));
  } catch (error) {
    console.error('Error in getDoctorById:', error);
    return res.status(500).json(new ApiResponse(500, null, 'Error fetching doctor'));
  }
};