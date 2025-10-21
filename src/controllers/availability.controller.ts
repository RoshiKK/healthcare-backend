import { Request, Response } from 'express';
import Availability from '../models/availability.model'
import ApiResponse from '../utils/apiResponse';
import ApiError from '../utils/apiError';

export const setDoctorAvailability = async (req: Request, res: Response) => {
  const doctorId = req.user?.userId;
  const { date, slots } = req.body;

  try {
    let availability = await Availability.findOne({ doctor: doctorId, date });
    
    if (availability) {
      availability.slots = slots;
      await availability.save();
    } else {
      availability = await Availability.create({
        doctor: doctorId,
        date,
        slots
      });
    }

    return res.status(200).json(new ApiResponse(200, availability, 'Availability updated'));
  } catch (error) {
    throw new ApiError(500, 'Error setting availability');
  }
};

export const getDoctorAvailability = async (req: Request, res: Response) => {
  const { doctorId, date } = req.query;
  
  if (!doctorId || !date) {
    throw new ApiError(400, 'Doctor ID and date are required');
  }

  try {
    const availability = await Availability.findOne({ 
      doctor: doctorId, 
      date: new Date(date as string) 
    });
    
    return res.status(200).json(new ApiResponse(200, availability || { slots: [] }));
  } catch (error) {
    throw new ApiError(500, 'Error fetching availability');
  }
};