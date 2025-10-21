'use client'

import { Request, Response } from 'express';
import User from '../models/user.model';
import ApiResponse from '../utils/apiResponse';

export const getPublicDoctors = async (req: Request, res: Response) => {
  try {
    const { search, specialization } = req.query;
    
    console.log('GET /api/public/doctors called with query:', { search, specialization });
    
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
      .lean();

    console.log('Found doctors:', doctors.length);

    // Transform the data
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
    console.error('Error in getPublicDoctors:', error);
    return res.status(500).json(new ApiResponse(500, null, 'Error fetching doctors'));
  }
};