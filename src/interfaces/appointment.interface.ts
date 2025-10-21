import { Document } from 'mongoose';

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'missed';

export interface IAppointment extends Document {
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  doctor: string;
  date: Date;
  startTime: string;
  endTime: string;
  symptoms: string;
  status: AppointmentStatus;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppointmentSlot {
  startTime: string;
  endTime: string;
  available: boolean;
  appointmentId?: string;
}

export interface CreateAppointmentDto {
  doctorId: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  date: Date;
  startTime: string;
  endTime: string;
  symptoms: string;
}

export interface RescheduleAppointmentDto {
  appointmentId: string;
  newDate: Date;
  newStartTime: string;
  newEndTime: string;
}

export interface CancelAppointmentDto {
  appointmentId: string;
  cancellationReason?: string;
}