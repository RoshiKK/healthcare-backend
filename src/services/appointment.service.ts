import Appointment from '../models/appointment.model';
import { sendEmail } from '../config/email';
import ApiError from '../utils/apiError';
import { AppointmentStatus } from '../interfaces/appointment.interface';

export const createAppointment = async (appointmentData: any) => {
  const { doctorId, date, startTime, endTime } = appointmentData;

  // Check for existing appointment
  const existingAppointment = await Appointment.findOne({
    doctor: doctorId,
    date,
    startTime,
    status: { $ne: 'cancelled' }
  });

  if (existingAppointment) {
    throw new ApiError(400, 'This time slot is already booked');
  }

  const appointment = await Appointment.create(appointmentData);

  // Send confirmation email
  await sendConfirmationEmail(appointment);

  return appointment;
};

export const getAvailableSlots = async (doctorId: string, date: Date) => {
  // Get all appointments for the doctor on this date
  const appointments = await Appointment.find({
    doctor: doctorId,
    date,
    status: { $ne: 'cancelled' }
  });

  // Generate all possible 30-minute slots from 9AM to 5PM
  const allSlots = generateTimeSlots('09:00', '17:00', 30);

  // Filter out booked slots
  const availableSlots = allSlots.filter(slot => 
    !appointments.some(appt => 
      appt.startTime === slot.startTime && appt.endTime === slot.endTime
    )
  );

  return availableSlots;
};

export const cancelAppointment = async (appointmentId: string) => {
  const appointment = await Appointment.findByIdAndUpdate(
    appointmentId,
    { status: 'cancelled' },
    { new: true }
  );

  if (!appointment) {
    throw new ApiError(404, 'Appointment not found');
  }

  // Send cancellation email
  await sendCancellationEmail(appointment);

  return appointment;
};

// Helper functions
function generateTimeSlots(start: string, end: string, interval: number) {
  const slots = [];
  let current = new Date(`1970-01-01T${start}:00`);
  const endTime = new Date(`1970-01-01T${end}:00`);
  
  while (current < endTime) {
    const startTime = current.toTimeString().substring(0, 5);
    current = new Date(current.getTime() + interval * 60000);
    const endTime = current.toTimeString().substring(0, 5);
    
    slots.push({ startTime, endTime });
  }
  
  return slots;
}

async function sendConfirmationEmail(appointment: any) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Appointment Confirmation</h2>
      <p>Dear ${appointment.patientName},</p>
      <p>Your appointment has been confirmed.</p>
      
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p><strong>Date:</strong> ${appointment.date.toDateString()}</p>
        <p><strong>Time:</strong> ${appointment.startTime} - ${appointment.endTime}</p>
      </div>
      
      <p>Best regards,</p>
      <p>The Healthcare Team</p>
    </div>
  `;

  await sendEmail({
    to: appointment.patientEmail,
    subject: "Appointment Confirmation",
    html,
  });
}

async function sendCancellationEmail(appointment: any) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Appointment Cancelled</h2>
      <p>Dear ${appointment.patientName},</p>
      <p>Your appointment has been cancelled.</p>
      
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p><strong>Original Date:</strong> ${appointment.date.toDateString()}</p>
        <p><strong>Time:</strong> ${appointment.startTime} - ${appointment.endTime}</p>
      </div>
      
      <p>Best regards,</p>
      <p>The Healthcare Team</p>
    </div>
  `;

  await sendEmail({
    to: appointment.patientEmail,
    subject: "Appointment Cancellation",
    html,
  });
}
