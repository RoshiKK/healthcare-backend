import mongoose, { Document, Schema } from 'mongoose';

export interface IAvailability extends Document {
  doctor: mongoose.Types.ObjectId;
  date: Date;
  slots: {
    startTime: string;
    endTime: string;
    available: boolean;
    appointmentId?: mongoose.Types.ObjectId;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const availabilitySchema = new Schema<IAvailability>(
  {
    doctor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    slots: [{
      startTime: { type: String, required: true },
      endTime: { type: String, required: true },
      available: { type: Boolean, default: true },
      appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment' }
    }]
  },
  { timestamps: true }
);

// Compound index for efficient querying
availabilitySchema.pre('save', function(next) {
  // Ensure date is stored as start of day
  if (this.date) {
    const date = new Date(this.date);
    date.setHours(0, 0, 0, 0);
    this.date = date;
  }
  
  // Format time slots properly
  this.slots = this.slots.map(slot => ({
    ...slot,
    startTime: slot.startTime.replace(/^(\d:\d{2})$/, '0$1'), // Format to HH:MM
    endTime: slot.endTime.replace(/^(\d:\d{2})$/, '0$1') // Format to HH:MM
  }));
  next();
});

export default mongoose.model<IAvailability>('Availability', availabilitySchema);