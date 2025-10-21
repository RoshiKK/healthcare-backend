import { Request, Response } from "express";
import Appointment from "../models/appointment.model";
import User from "../models/user.model";
import ApiError from "../utils/apiError";
import ApiResponse from "../utils/apiResponse";
import {
  sendAppointmentConfirmation,
  sendAppointmentCancellation,
} from "../services/email.service";
import Availability from "../models/availability.model";
import logger from "../utils/logger";
import mongoose from "mongoose";

export const bookAppointment = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      doctorId,
      patientName,
      patientEmail,
      patientPhone,
      date,
      startTime,
      endTime,
      symptoms,
    } = req.body;

    console.log("🔄 Booking appointment with data:", req.body);

    // Validate required fields
    if (
      !doctorId ||
      !patientName ||
      !patientEmail ||
      !date ||
      !startTime ||
      !endTime
    ) {
      throw new ApiError(400, "Missing required fields");
    }

    // Validate doctor exists and is active
    const doctor = await User.findOne({
      _id: doctorId,
      role: "doctor",
      isActive: true,
    }).session(session);

    if (!doctor) {
      throw new ApiError(404, "Doctor not found or not available");
    }

    // Convert date to proper format
    const appointmentDate = new Date(date);
    if (isNaN(appointmentDate.getTime())) {
      throw new ApiError(400, "Invalid date format");
    }

    // Normalize date to start of day for comparison
    const normalizedDate = new Date(appointmentDate);
    normalizedDate.setHours(0, 0, 0, 0);

    // Check for existing appointment in the same slot
    const existingAppointment = await Appointment.findOne({
      doctor: doctorId,
      date: {
        $gte: new Date(normalizedDate),
        $lt: new Date(normalizedDate.getTime() + 24 * 60 * 60 * 1000),
      },
      startTime,
      status: { $ne: "cancelled" },
    }).session(session);

    if (existingAppointment) {
      throw new ApiError(400, "This time slot is already booked");
    }

    // Create appointment
    const appointment = new Appointment({
      patientName,
      patientEmail,
      patientPhone,
      doctor: doctorId,
      date: appointmentDate,
      startTime,
      endTime,
      symptoms: symptoms || "Not specified",
      status: "confirmed",
    });

    await appointment.save({ session });

    await session.commitTransaction();
    session.endSession();

    console.log("✅ Appointment created successfully:", appointment._id);

    // Send confirmation email (non-blocking)
    try {
      await sendAppointmentConfirmation({
        to: patientEmail,
        doctorName: doctor.name,
        date: appointmentDate,
        startTime,
        endTime,
        patientName,
        appointmentId: appointment._id.toString(),
      });
      console.log("✅ Confirmation email sent");
    } catch (emailError) {
      logger.error(
        "Failed to send confirmation email, but appointment was booked:",
        emailError
      );
    }

    // Populate doctor info for response
    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate("doctor", "name specialization")
      .lean();

    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          populatedAppointment,
          "Appointment booked successfully"
        )
      );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("❌ Error booking appointment:", error);

    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      500,
      "Error booking appointment: " + (error as Error).message
    );
  }
};

export const cancelAppointment = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { appointmentId } = req.params;
    const { cancellationReason } = req.body;

    if (!appointmentId) {
      throw new ApiError(400, "Appointment ID is required");
    }

    const appointment = await Appointment.findById(appointmentId).session(session);
    if (!appointment) {
      throw new ApiError(404, "Appointment not found");
    }

    // Update appointment status
    appointment.status = "cancelled";
    appointment.cancellationReason = cancellationReason;
    await appointment.save({ session });

    // Free up the time slot
    await Availability.updateOne(
      {
        doctor: appointment.doctor,
        date: appointment.date,
        "slots.appointmentId": appointment._id,
      },
      {
        $set: {
          "slots.$.available": true,
          "slots.$.appointmentId": null,
        },
      }
    ).session(session);

    await session.commitTransaction();

    // Send cancellation email - FIXED: Use the correct variables from the appointment object
    try {
  const doctor = await User.findById(appointment.doctor);
  if (doctor) {
    await sendAppointmentCancellation({
      to: appointment.patientEmail,
      doctorName: doctor.name,
      date: appointment.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      patientName: appointment.patientName,
      appointmentId: appointment._id.toString(),
    });
    console.log("✅ Cancellation email sent successfully");
  } else {
    console.log("⚠️ Doctor not found for email sending");
  }
} catch (emailError) {
  console.error("❌ Failed to send cancellation email:", emailError);
  logger.error("Failed to send cancellation email:", emailError);
}

    return res.status(200).json(
      new ApiResponse(200, appointment, "Appointment cancelled successfully")
    );
  } catch (error) {
    await session.abortTransaction();

    if (error instanceof ApiError) {
      throw error;
    }
    logger.error("Error cancelling appointment:", error);
    throw new ApiError(500, "Error cancelling appointment");
  } finally {
    session.endSession();
  }
};

export const rescheduleAppointment = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { appointmentId } = req.params;
    const { newDate, newStartTime, newEndTime } = req.body;

    if (!appointmentId || !newDate || !newStartTime || !newEndTime) {
      throw new ApiError(
        400,
        "Appointment ID and new time details are required"
      );
    }

    const appointment = await Appointment.findById(appointmentId).session(
      session
    );
    if (!appointment) {
      throw new ApiError(404, "Appointment not found");
    }

    const newAppointmentDate = new Date(newDate);

    // Check if new slot is available
    const existingAppointment = await Appointment.findOne({
      doctor: appointment.doctor,
      date: newAppointmentDate,
      startTime: newStartTime,
      status: { $ne: "cancelled" },
      _id: { $ne: appointmentId },
    }).session(session);

    if (existingAppointment) {
      throw new ApiError(400, "The new time slot is already booked");
    }

    // Free old slot
    await Availability.updateOne(
      {
        doctor: appointment.doctor,
        date: appointment.date,
        "slots.appointmentId": appointment._id,
      },
      {
        $set: {
          "slots.$.available": true,
          "slots.$.appointmentId": null,
        },
      }
    ).session(session);

    // Check and book new slot
    const availability = await Availability.findOne({
      doctor: appointment.doctor,
      date: newAppointmentDate,
      "slots.startTime": newStartTime,
      "slots.endTime": newEndTime,
      "slots.available": true,
    }).session(session);

    if (!availability) {
      throw new ApiError(400, "The new time slot is not available");
    }

    // Update appointment
    appointment.date = newAppointmentDate;
    appointment.startTime = newStartTime;
    appointment.endTime = newEndTime;
    appointment.status = "confirmed";
    await appointment.save({ session });

    // Reserve new slot
    await Availability.updateOne(
      {
        doctor: appointment.doctor,
        date: newAppointmentDate,
        "slots.startTime": newStartTime,
        "slots.endTime": newEndTime,
      },
      {
        $set: {
          "slots.$.available": false,
          "slots.$.appointmentId": appointment._id,
        },
      }
    ).session(session);

    await session.commitTransaction();

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          appointment,
          "Appointment rescheduled successfully"
        )
      );
  } catch (error) {
    await session.abortTransaction();

    if (error instanceof ApiError) {
      throw error;
    }
    logger.error("Error rescheduling appointment:", error);
    throw new ApiError(500, "Error rescheduling appointment");
  } finally {
    session.endSession();
  }
};

// Update getAvailableSlots to consider existing appointments
export const getAvailableSlots = async (req: Request, res: Response) => {
  const { doctorId, date } = req.query;

  console.log("🔄 getAvailableSlots called with:", { doctorId, date });

  if (!doctorId || !date) {
    throw new ApiError(400, "Doctor ID and date are required");
  }

  try {
    // Fix date parsing - ensure it's in the correct format
    const appointmentDate = new Date(date as string);
    // Normalize the date to start of day for proper comparison
    appointmentDate.setHours(0, 0, 0, 0);

    console.log("📅 Parsed date:", appointmentDate.toISOString());

    // Get doctor's availability for this date
    const availability = await Availability.findOne({
      doctor: doctorId,
      date: {
        $gte: new Date(appointmentDate.setHours(0, 0, 0, 0)),
        $lte: new Date(appointmentDate.setHours(23, 59, 59, 999)),
      },
    });

    console.log("📋 Availability found:", availability ? "Yes" : "No");

    // Get booked appointments for this date
    const bookedAppointments = await Appointment.find({
      doctor: doctorId,
      date: {
        $gte: new Date(appointmentDate.setHours(0, 0, 0, 0)),
        $lte: new Date(appointmentDate.setHours(23, 59, 59, 999)),
      },
      status: { $ne: "cancelled" },
    });

    console.log("📖 Booked appointments:", bookedAppointments.length);

    const bookedSlots = new Set(
      bookedAppointments.map((apt) => `${apt.startTime}-${apt.endTime}`)
    );

    console.log("🚫 Booked slots:", Array.from(bookedSlots));

    let availableSlots = [];

    if (availability && availability.slots && availability.slots.length > 0) {
      // Use doctor's custom availability
      availableSlots = availability.slots
        .filter((slot) => {
          const isAvailable =
            slot.available &&
            !bookedSlots.has(`${slot.startTime}-${slot.endTime}`);
          console.log(
            `⏰ Slot ${slot.startTime}-${slot.endTime}: available=${
              slot.available
            }, booked=${bookedSlots.has(
              `${slot.startTime}-${slot.endTime}`
            )}, result=${isAvailable}`
          );
          return isAvailable;
        })
        .map((slot) => ({
          startTime: slot.startTime,
          endTime: slot.endTime,
          available: true,
        }));

      console.log("✅ Custom slots available:", availableSlots.length);
    } else {
      // Generate default slots (9 AM to 5 PM, 30-minute intervals)
      const defaultSlots = [
        { startTime: "09:00", endTime: "09:30" },
        { startTime: "09:30", endTime: "10:00" },
        { startTime: "10:00", endTime: "10:30" },
        { startTime: "10:30", endTime: "11:00" },
        { startTime: "11:00", endTime: "11:30" },
        { startTime: "11:30", endTime: "12:00" },
        { startTime: "12:00", endTime: "12:30" },
        { startTime: "12:30", endTime: "13:00" },
        { startTime: "13:00", endTime: "13:30" },
        { startTime: "13:30", endTime: "14:00" },
        { startTime: "14:00", endTime: "14:30" },
        { startTime: "14:30", endTime: "15:00" },
        { startTime: "15:00", endTime: "15:30" },
        { startTime: "15:30", endTime: "16:00" },
        { startTime: "16:00", endTime: "16:30" },
        { startTime: "16:30", endTime: "17:00" },
      ];

      availableSlots = defaultSlots
        .filter((slot) => !bookedSlots.has(`${slot.startTime}-${slot.endTime}`))
        .map((slot) => ({
          ...slot,
          available: true,
        }));

      console.log("✅ Default slots available:", availableSlots.length);
    }

    console.log("🎯 Final available slots:", availableSlots);

    return res.status(200).json(
      new ApiResponse(200, {
        availableSlots,
        totalSlots: availableSlots.length,
        date: appointmentDate.toISOString().split("T")[0],
        message: "Slots fetched successfully",
      })
    );
  } catch (error) {
    console.error("❌ Error in getAvailableSlots:", error);
    throw new ApiError(500, "Error fetching available slots");
  }
};

// Keep existing functions but update them with proper error handling
export const getPatientAppointments = async (req: Request, res: Response) => {
  try {
    const { patientEmail } = req.query;

    if (!patientEmail) {
      throw new ApiError(400, "Patient email is required");
    }

    const appointments = await Appointment.find({
      patientEmail: patientEmail as string,
    })
      .populate({
        path: "doctor",
        select: "name specialization",
        model: "User",
      })
      .sort({ date: -1, startTime: -1 });

    const transformedAppointments = appointments.map((appointment) => {
      const appointmentObj = appointment.toObject();
      const doctor = appointmentObj.doctor as any;

      return {
        id: appointmentObj._id.toString(),
        _id: appointmentObj._id,
        patientName: appointmentObj.patientName,
        patientEmail: appointmentObj.patientEmail,
        patientPhone: appointmentObj.patientPhone,
        doctor: appointmentObj.doctor,
        doctorName: doctor?.name || "Unknown Doctor",
        date: appointmentObj.date,
        startTime: appointmentObj.startTime,
        endTime: appointmentObj.endTime,
        symptoms: appointmentObj.symptoms,
        status: appointmentObj.status,
        createdAt: appointmentObj.createdAt,
        updatedAt: appointmentObj.updatedAt,
        cancellationReason: appointmentObj.cancellationReason,
      };
    });

    return res.status(200).json(new ApiResponse(200, transformedAppointments));
  } catch (error) {
    console.error("Error fetching patient appointments:", error);
    throw new ApiError(500, "Error fetching appointments");
  }
};
