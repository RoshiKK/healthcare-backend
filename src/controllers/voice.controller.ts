import { Request, Response } from "express";
import Appointment from "../models/appointment.model";
import User from "../models/user.model";
import Availability from "../models/availability.model";
import ApiResponse from "../utils/apiResponse";
import ApiError from "../utils/apiError";
import { sendAppointmentConfirmation } from "../services/email.service";
import mongoose from "mongoose";

// ---------------- Voice Session Manager ----------------
interface VoiceSession {
  sessionId: string;
  step: string;
  patientName?: string;
  patientEmail?: string;
  patientPhone?: string;
  symptoms?: string;
  doctorId?: string;
  doctorName?: string;
  lastActivity: Date;
}

class VoiceSessionManager {
  private sessions: Map<string, VoiceSession> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired sessions every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 60 * 1000);
  }

  createSession(sessionId: string, session: VoiceSession): void {
    this.sessions.set(sessionId, {
      ...session,
      lastActivity: new Date(),
    });
  }

  getSession(sessionId: string): VoiceSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
    return session;
  }

  updateSession(sessionId: string, updates: Partial<VoiceSession>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.set(sessionId, {
        ...session,
        ...updates,
        lastActivity: new Date(),
      });
    }
  }

  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    const expiredTime = 30 * 60 * 1000; // 30 minutes

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now.getTime() - session.lastActivity.getTime() > expiredTime) {
        this.sessions.delete(sessionId);
      }
    }
  }

  getSessionCount(): number {
    return this.sessions.size;
  }
}

const sessionManager = new VoiceSessionManager();

// ---------------- Voice Session Handlers ----------------
export const initiateVoiceSession = async (req: Request, res: Response) => {
  const { doctorId } = req.body;

  try {
    console.log("🎯 Initiating voice session for doctor:", doctorId);

    if (!doctorId) {
      throw new ApiError(400, "Doctor ID is required");
    }

    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.role !== "doctor") {
      console.error("❌ Doctor not found:", doctorId);
      throw new ApiError(404, "Doctor not found");
    }

    const sessionId = generateSessionId();
    const session: VoiceSession = {
      sessionId,
      step: "name",
      doctorId,
      doctorName: doctor.name,
      lastActivity: new Date(),
    };

    sessionManager.createSession(sessionId, session);

    console.log("✅ Voice session created:", sessionId);
    console.log("📊 Active sessions:", sessionManager.getSessionCount());

    const welcomeMessage = `Hello! I'll help you book an appointment with Dr. ${doctor.name}, a ${doctor.specialization}. Please tell me your full name.`;

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          sessionId,
          welcomeMessage,
          nextStep: "name",
          doctorInfo: {
            name: doctor.name,
            specialization: doctor.specialization,
          },
        },
        "Voice session initiated successfully"
      )
    );
  } catch (error) {
    console.error("❌ Error initiating voice session:", error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, "Failed to initiate voice session");
  }
};

export const processVoiceCommand = async (req: Request, res: Response) => {
  const { sessionId, text, doctorId } = req.body;

  try {
    console.log("🔄 Processing voice command:", {
      sessionId: sessionId || "undefined",
      text: text ? `${text.substring(0, 50)}...` : "undefined",
      doctorId: doctorId || "undefined",
    });

    // Validate required fields
    if (!text || text.trim().length === 0) {
      throw new ApiError(
        400,
        "No speech detected. Please speak clearly and try again."
      );
    }

    let session: VoiceSession | undefined;
    let currentSessionId = sessionId;

    // Try to find existing session for this doctor
    if (!currentSessionId && doctorId) {
      console.log("🔍 Looking for existing session for doctor:", doctorId);

      // Find any active session for this doctor
      for (const [existingSessionId, existingSession] of sessionManager[
        "sessions"
      ].entries()) {
        if (existingSession.doctorId === doctorId) {
          const timeDiff = Date.now() - existingSession.lastActivity.getTime();
          // Use session if it's less than 10 minutes old
          if (timeDiff < 10 * 60 * 1000) {
            session = existingSession;
            currentSessionId = existingSessionId;
            console.log("✅ Found existing session:", currentSessionId);
            break;
          }
        }
      }
    }

    // If still no session, create a new one
    if (!session && doctorId) {
      console.log("🔄 Creating new session for doctor:", doctorId);

      const doctor = await User.findById(doctorId);
      if (!doctor) {
        throw new ApiError(404, "Doctor not found");
      }

      currentSessionId = generateSessionId();
      const newSession: VoiceSession = {
        sessionId: currentSessionId,
        step: "name",
        doctorId,
        doctorName: doctor.name,
        lastActivity: new Date(),
      };

      sessionManager.createSession(currentSessionId, newSession);
      session = newSession;

      console.log("✅ New voice session created:", currentSessionId);
    }

    if (!session) {
      throw new ApiError(400, "Doctor ID is required to start a session");
    }

    console.log("📋 Current session state:", {
      step: session.step,
      patientName: session.patientName,
      patientEmail: session.patientEmail,
      patientPhone: session.patientPhone,
      symptoms: session.symptoms,
    });

    // Update last activity
    sessionManager.updateSession(currentSessionId, {
      lastActivity: new Date(),
    });

    // Run conversation logic
    const response = await handleConversationFlow(text, session);

    sessionManager.updateSession(currentSessionId, response.updatedSession);

    console.log("✅ Voice command processed successfully:", {
      nextStep: response.nextStep,
      message: response.message.substring(0, 100) + "...",
    });

    // 🟢 AUTO-BOOKING TRIGGER
    if (
      response.nextStep === "complete" &&
      response.updatedSession.step === "complete"
    ) {
      try {
        console.log(
          "🔄 Auto-triggering voice booking with session data:",
          response.updatedSession
        );

        // Call the booking function directly instead of API call
        const bookingResult = await voiceBookAppointmentDirect({
          sessionId: response.updatedSession.sessionId,
          doctorId: response.updatedSession.doctorId!,
          patientName: response.updatedSession.patientName!,
          patientEmail: response.updatedSession.patientEmail!,
          patientPhone: response.updatedSession.patientPhone!,
          symptoms:
            response.updatedSession.symptoms || "Not specified via voice",
        });

        console.log("✅ Voice booking result:", bookingResult);

        // Clean up session
        sessionManager.deleteSession(currentSessionId);

        return res.status(200).json(
          new ApiResponse(
            200,
            {
              message:
                "🎉 Appointment booked successfully! You will receive a confirmation email shortly. Thank you for using voice booking!",
              nextStep: "ended",
              updatedData: response.updatedSession,
              isComplete: true,
              bookingResult: bookingResult,
            },
            "Appointment booked successfully"
          )
        );
      } catch (bookingError: any) {
        console.error("❌ Auto-booking failed:", bookingError);

        return res.status(200).json(
          new ApiResponse(
            200,
            {
              message: `Sorry, I couldn't complete the booking: ${bookingError.message}. Please try the form booking instead.`,
              nextStep: "error",
              updatedData: response.updatedSession,
              isComplete: false,
            },
            "Booking failed"
          )
        );
      }
    }

    // 🟡 Default (non-final) response
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          sessionId: currentSessionId,
          message: response.message,
          nextStep: response.nextStep,
          updatedData: response.updatedSession,
          isComplete: response.nextStep === "complete",
          doctorId: doctorId,
        },
        "Voice command processed successfully"
      )
    );
  } catch (error) {
    console.error("❌ Error processing voice command:", error);

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        error: error.message,
      });
    }

    const errorMessage =
      "I encountered an error processing your request. Please try speaking again or use the form booking.";
    console.error("Unexpected error details:", error);

    return res.status(500).json({
      success: false,
      message: errorMessage,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Direct booking function to avoid API calls
const voiceBookAppointmentDirect = async (params: {
  sessionId: string;
  doctorId: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  symptoms: string;
}) => {
  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    const { doctorId, patientName, patientEmail, patientPhone, symptoms } =
      params;

    console.log("📦 Voice direct booking:", {
      doctorId: doctorId || "undefined",
      patientName: patientName || "undefined",
      patientEmail: patientEmail
        ? `${patientEmail.substring(0, 5)}...`
        : "undefined",
      patientPhone: patientPhone || "undefined",
      symptoms: symptoms || "undefined",
    });

    // Validate required fields
    if (!doctorId) {
      throw new ApiError(400, "Doctor information is missing");
    }
    if (!patientName) {
      throw new ApiError(400, "Patient name is required");
    }
    if (!patientEmail) {
      throw new ApiError(400, "Patient email is required");
    }
    if (!patientPhone) {
      throw new ApiError(400, "Patient phone number is required");
    }

    const doctor = await User.findOne({
      _id: doctorId,
      role: "doctor",
      isActive: true,
    }).session(dbSession);

    if (!doctor) {
      throw new ApiError(404, "Doctor not found or not available");
    }

    // Try to find available slots in the next 7 days
    let appointmentDate: Date | null = null;
    let availableSlot: any = null;

    for (let daysAhead = 1; daysAhead <= 7; daysAhead++) {
      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() + daysAhead);
      checkDate.setHours(0, 0, 0, 0);

      console.log(
        `🔍 Checking availability for date: ${checkDate.toDateString()}`
      );

      // Check doctor's custom availability first
      const availability = await Availability.findOne({
        doctor: doctorId,
        date: checkDate,
        "slots.available": true,
      }).session(dbSession);

      if (availability && availability.slots.length > 0) {
        // Find first available slot
        availableSlot = availability.slots.find((slot: any) => slot.available);
        if (availableSlot) {
          appointmentDate = checkDate;
          console.log(
            `✅ Found custom availability on ${checkDate.toDateString()}:`,
            availableSlot
          );
          break;
        }
      }

      // If no custom availability, check for existing appointments and use default slots
      const existingAppointments = await Appointment.find({
        doctor: doctorId,
        date: {
          $gte: new Date(checkDate.setHours(0, 0, 0, 0)),
          $lte: new Date(checkDate.setHours(23, 59, 59, 999)),
        },
        status: { $ne: "cancelled" },
      }).session(dbSession);

      const bookedSlots = new Set(
        existingAppointments.map(
          (apt: any) => `${apt.startTime}-${apt.endTime}`
        )
      );

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

      // Find first available default slot
      availableSlot = defaultSlots.find(
        (slot) => !bookedSlots.has(`${slot.startTime}-${slot.endTime}`)
      );

      if (availableSlot) {
        appointmentDate = checkDate;
        console.log(
          `✅ Found default slot on ${checkDate.toDateString()}:`,
          availableSlot
        );
        break;
      }

      console.log(`❌ No available slots on ${checkDate.toDateString()}`);
    }

    if (!appointmentDate || !availableSlot) {
      throw new ApiError(
        400,
        "No available slots found in the next 7 days. Please try another doctor or contact the clinic."
      );
    }

    console.log("✅ Final selected slot:", {
      date: appointmentDate,
      slot: availableSlot,
    });

    // Create appointment
    const appointment = await Appointment.create(
      [
        {
          patientName,
          patientEmail,
          patientPhone,
          doctor: doctorId,
          date: appointmentDate,
          startTime: availableSlot.startTime,
          endTime: availableSlot.endTime,
          symptoms: symptoms || "Not specified via voice",
          status: "confirmed",
        },
      ],
      { session: dbSession }
    );

    // Update availability if it was a custom slot
    const availability = await Availability.findOne({
      doctor: doctorId,
      date: appointmentDate,
      "slots.startTime": availableSlot.startTime,
      "slots.endTime": availableSlot.endTime,
    }).session(dbSession);

    if (availability) {
      await Availability.updateOne(
        {
          doctor: doctorId,
          date: appointmentDate,
          "slots.startTime": availableSlot.startTime,
          "slots.endTime": availableSlot.endTime,
        },
        {
          $set: {
            "slots.$.available": false,
            "slots.$.appointmentId": appointment[0]._id,
          },
        }
      ).session(dbSession);
    }

    await dbSession.commitTransaction();
    dbSession.endSession();

    console.log("✅ Appointment created successfully:", appointment[0]._id);

    // Send confirmation email
    try {
      await sendAppointmentConfirmation({
        to: patientEmail,
        patientName,
        doctorName: doctor.name,
        date: appointmentDate,
        startTime: availableSlot.startTime,
        endTime: availableSlot.endTime,
        appointmentId: appointment[0]._id.toString(),
      });
      console.log("✅ Confirmation email sent");
    } catch (emailError) {
      console.error("❌ Failed to send confirmation email:", emailError);
      // Don't fail the booking if email fails
    }

    return {
      appointment: appointment[0],
      message: `Appointment booked successfully for ${appointmentDate.toDateString()} at ${
        availableSlot.startTime
      }`,
      emailSent: true,
      appointmentDate: appointmentDate.toISOString(),
      timeSlot: `${availableSlot.startTime} - ${availableSlot.endTime}`,
    };
  } catch (error) {
    await dbSession.abortTransaction();
    dbSession.endSession();

    console.error("❌ Error in voice booking:", error);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      500,
      "Error booking appointment via voice: " + (error as Error).message
    );
  }
};

export const voiceBookAppointment = async (req: Request, res: Response) => {
  try {
    const result = await voiceBookAppointmentDirect(req.body);
    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          result,
          "Appointment booked successfully via voice"
        )
      );
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, "Error booking appointment via voice");
  }
};

// ---------------- Helpers ----------------
const generateSessionId = (): string => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const handleConversationFlow = (text: string, session: VoiceSession) => {
  const lowerText = text.toLowerCase().trim();

  console.log(
    `🔄 Handling conversation flow - Step: ${session.step}, Input: "${text}"`
  );
  console.log("📋 Current session data:", {
    patientName: session.patientName,
    patientEmail: session.patientEmail,
    patientPhone: session.patientPhone,
    symptoms: session.symptoms,
  });

  // Validate session data
  if (!session.doctorId || !session.doctorName) {
    session.step = "error";
    return {
      message:
        "I'm having trouble with this session. Please restart the voice booking.",
      nextStep: "error",
      updatedSession: session,
    };
  }

  // Handle exit
  if (
    lowerText.includes("exit") ||
    lowerText.includes("quit") ||
    lowerText.includes("stop")
  ) {
    sessionManager.deleteSession(session.sessionId);
    return {
      message:
        "Voice booking session ended. Feel free to use the form booking if you'd like to continue.",
      nextStep: "ended",
      updatedSession: session,
    };
  }

  // Handle help
  if (lowerText.includes("help")) {
    return getHelpMessage(session.step, session);
  }

  switch (session.step) {
    case "name":
      if (lowerText.length < 2) {
        return {
          message:
            "I didn't catch that. Could you please tell me your full name?",
          nextStep: "name",
          updatedSession: session,
        };
      }

      // Validate name (should contain at least first and last name)
      const nameParts = text.trim().split(/\s+/);
      if (nameParts.length < 2) {
        return {
          message: "Please provide your full name (first and last name).",
          nextStep: "name",
          updatedSession: session,
        };
      }

      session.patientName = text.trim();
      session.step = "email";
      return {
        message: `Nice to meet you, ${session.patientName}. What's your email address?`,
        nextStep: "email",
        updatedSession: session,
      };

    case "email":
      let emailInput = text.trim().toLowerCase();

      // Handle common voice-to-text issues for emails
      emailInput = emailInput
        .replace(/\s*(at|add|act|hat|that)\s*/gi, "@")
        .replace(/\s*(dot|doht|dought|dart)\s*/gi, ".")
        .replace(/\s*(gmail|g male|g mail)\s*/gi, "gmail")
        .replace(/\s*(hotmail|hot male|hot mail)\s*/gi, "hotmail")
        .replace(/\s*(yahoo|yahu|yahuu)\s*/gi, "yahoo")
        .replace(/\s*(outlook|out look)\s*/gi, "outlook")
        .replace(/\s+/g, ""); // Remove any remaining spaces

      console.log("📧 Processed email input:", emailInput);

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(emailInput)) {
        // Try to auto-correct common patterns
        let suggestedEmail = emailInput;

        // If no @ found, try to insert it before the last word
        if (!emailInput.includes("@")) {
          const parts = text.trim().toLowerCase().split(/\s+/);
          if (parts.length >= 2) {
            // Assume format: "username provider.com" -> "username@provider.com"
            suggestedEmail = `${parts[0]}@${parts
              .slice(1)
              .join("")
              .replace(/dot|doht|dought|dart/gi, ".")}`;
            suggestedEmail = suggestedEmail.replace(/\s+/g, "");
          }
        }

        // Validate the suggested email
        if (emailRegex.test(suggestedEmail)) {
          session.patientEmail = suggestedEmail;
          session.step = "email_confirmation";
          return {
            message: `I think you meant ${suggestedEmail}. Is that correct? Say 'YES' to continue or 'NO' to correct it.`,
            nextStep: "email_confirmation",
            updatedSession: session,
          };
        }

        return {
          message:
            "I'm having trouble understanding the email. Please say it slowly and clearly, like: 'john dot doe at gmail dot com'",
          nextStep: "email",
          updatedSession: session,
        };
      }

      session.patientEmail = emailInput;
      session.step = "phone";
      return {
        message: `Great! I have your email as ${emailInput}. Now what's your phone number?`,
        nextStep: "phone",
        updatedSession: session,
      };

    case "email_confirmation":
      if (
        lowerText.includes("yes") ||
        lowerText.includes("correct") ||
        lowerText.includes("right") ||
        lowerText.includes("yeah") ||
        lowerText.includes("yep")
      ) {
        session.step = "phone";
        return {
          message: `Perfect! Now what's your phone number?`,
          nextStep: "phone",
          updatedSession: session,
        };
      } else if (
        lowerText.includes("no") ||
        lowerText.includes("wrong") ||
        lowerText.includes("incorrect") ||
        lowerText.includes("nope")
      ) {
        session.patientEmail = undefined;
        session.step = "email";
        return {
          message: "Okay, let's try again. What's your email address?",
          nextStep: "email",
          updatedSession: session,
        };
      } else {
        return {
          message:
            "Please say 'YES' if the email is correct, or 'NO' to enter it again.",
          nextStep: "email_confirmation",
          updatedSession: session,
        };
      }

    case "phone":
      // Extract numbers from the input
      const phoneNumbers = text.replace(/\D/g, "");

      if (phoneNumbers.length < 10) {
        return {
          message:
            "I need a valid phone number with at least 10 digits. Please say your phone number again.",
          nextStep: "phone",
          updatedSession: session,
        };
      }

      // Format phone number
      let formattedPhone = phoneNumbers;
      if (phoneNumbers.length === 10) {
        formattedPhone = `${phoneNumbers.substring(
          0,
          3
        )}-${phoneNumbers.substring(3, 6)}-${phoneNumbers.substring(6)}`;
      }

      session.patientPhone = formattedPhone;
      session.step = "symptoms";
      return {
        message: `Thank you! I have your phone number as ${formattedPhone}. Now, please describe your symptoms or the reason for your visit.`,
        nextStep: "symptoms",
        updatedSession: session,
      };

    case "symptoms":
      if (text.trim().length < 5) {
        return {
          message:
            "Please describe your symptoms in a bit more detail so the doctor can better prepare for your visit.",
          nextStep: "symptoms",
          updatedSession: session,
        };
      }

      session.symptoms = text.trim();
      session.step = "confirmation";

      // Create confirmation message with all details
      const confirmationMessage = `Let me confirm your details:
        Name: ${session.patientName}
        Email: ${session.patientEmail}
        Phone: ${session.patientPhone}
        Symptoms: ${session.symptoms}
        Doctor: Dr. ${session.doctorName}
        
        Say 'YES' to confirm and book your appointment, or 'NO' to start over.`;

      return {
        message: confirmationMessage,
        nextStep: "confirmation",
        updatedSession: session,
      };

    case "confirmation":
      if (
        lowerText.includes("yes") ||
        lowerText.includes("confirm") ||
        lowerText.includes("book") ||
        lowerText.includes("proceed")
      ) {
        session.step = "complete";

        // Generate a tentative appointment message
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tentativeDate = tomorrow.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        return {
          message: `Great! I'm booking your appointment with Dr. ${session.doctorName} for the next available slot. This usually means tomorrow (${tentativeDate}) or within the next few days. I'll find the best available time and send you a confirmation email with all the details.`,
          nextStep: "complete",
          updatedSession: session,
        };
      } else if (
        lowerText.includes("no") ||
        lowerText.includes("cancel") ||
        lowerText.includes("start over")
      ) {
        // Reset all data and start over
        session.patientName = undefined;
        session.patientEmail = undefined;
        session.patientPhone = undefined;
        session.symptoms = undefined;
        session.step = "name";
        return {
          message: "Okay, let's start over. What's your full name?",
          nextStep: "name",
          updatedSession: session,
        };
      } else {
        return {
          message:
            "Please say 'YES' to confirm and book your appointment, or 'NO' to start over.",
          nextStep: "confirmation",
          updatedSession: session,
        };
      }

    case "complete":
      // This step should trigger the actual booking
      return {
        message: "Booking your appointment now...",
        nextStep: "complete",
        updatedSession: session,
      };

    default:
      return {
        message:
          "I didn't understand that. Could you please repeat or say 'restart' to begin again?",
        nextStep: session.step,
        updatedSession: session,
      };
  }
};

const getHelpMessage = (step: string, session: VoiceSession) => {
  const helpMessages = {
    name: "Please tell me your full name as it appears on your identification. For example: 'John Smith'",
    email:
      "Please provide your email address where we can send confirmation details. For example: 'john.smith@example.com' or say 'john dot smith at gmail dot com'",
    phone:
      "Please provide your phone number with area code. You can say it with spaces or dashes. For example: '555-123-4567'",
    symptoms:
      "Please describe any symptoms or the reason for your visit. This helps the doctor prepare for your appointment. For example: 'I have a fever and cough for three days'",
    confirmation:
      "Please say 'YES' to confirm your appointment or 'NO' to start over. You can also say 'RESTART' to begin a new booking.",
    default:
      "I'm here to help you book an appointment. Just answer my questions one by one. You can say 'HELP' at any time for assistance.",
  };

  return {
    message:
      helpMessages[step as keyof typeof helpMessages] || helpMessages.default,
    nextStep: step,
    updatedSession: session,
  };
};
