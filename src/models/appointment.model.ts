import mongoose, { Document, Schema } from 'mongoose';
import { AppointmentStatus } from '../interfaces/appointment.interface';

export interface IAppointment extends Document {
  _id: mongoose.Types.ObjectId;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  doctor: mongoose.Types.ObjectId;
  date: Date;
  startTime: string;
  endTime: string;
  symptoms: string;
  status: AppointmentStatus;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const appointmentSchema = new Schema<IAppointment>(
  {
    patientName: { type: String, required: true },
    patientEmail: { type: String, required: true },
    patientPhone: { type: String, required: true },
    doctor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    symptoms: { type: String, required: true },
    status: { 
      type: String, 
      enum: ['pending', 'confirmed', 'completed', 'cancelled', 'missed'], 
      default: 'confirmed' 
    },
    cancellationReason: { type: String }
  },
  { timestamps: true }
);

// Add indexes for better performance
appointmentSchema.index({ doctor: 1, date: 1 });
appointmentSchema.index({ patientEmail: 1, date: -1 });
appointmentSchema.index({ status: 1, date: 1 });

export default mongoose.model<IAppointment>('Appointment', appointmentSchema);