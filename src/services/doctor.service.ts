import Appointment from '../models/appointment.model';
import User from '../models/user.model';
import ApiError from '../utils/apiError';
import { AppointmentStatus } from '../interfaces/appointment.interface';

export const getDoctorAppointments = async (doctorId: string, filters: any = {}) => {
  const query: any = { doctor: doctorId };
  
  if (filters.status) {
    query.status = filters.status;
  }
  
  if (filters.date) {
    query.date = filters.date;
  }

  return await Appointment.find(query)
    .sort({ date: 1, startTime: 1 });
};

export const updateAppointmentStatus = async (
  appointmentId: string, 
  status: AppointmentStatus,
  doctorId: string
) => {
  const appointment = await Appointment.findOneAndUpdate(
    { _id: appointmentId, doctor: doctorId },
    { status },
    { new: true }
  );

  if (!appointment) {
    throw new ApiError(404, 'Appointment not found or not authorized');
  }

  return appointment;
};

export const getDoctorStats = async (doctorId: string) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [totalAppointments, todayAppointments, nextAppointment] = await Promise.all([
    Appointment.countDocuments({ doctor: doctorId }),
    Appointment.countDocuments({ 
      doctor: doctorId,
      date: { $gte: todayStart, $lte: todayEnd }
    }),
    Appointment.findOne({ 
      doctor: doctorId,
      date: { $gte: new Date() },
      status: 'pending'
    }).sort({ date: 1, startTime: 1 })
  ]);

  return {
    totalAppointments,
    todayAppointments,
    nextAppointment
  };
};

export const setDoctorAvailability = async (doctorId: string, availability: any) => {
  // In a real implementation, you would save this to a separate availability collection
  return await User.findByIdAndUpdate(
    doctorId,
    { $set: { availability } },
    { new: true }
  );
};