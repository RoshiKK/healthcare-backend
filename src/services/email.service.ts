import { Resend } from 'resend';
import logger from '../utils/logger';

// Initialize Resend with proper error handling
const resendApiKey = process.env.RESEND_API_KEY;
if (!resendApiKey) {
  logger.error('RESEND_API_KEY is not configured');
  throw new Error('RESEND_API_KEY is required');
}

const resend = new Resend(resendApiKey);

// Use a verified domain or the Resend test domain
const FROM_EMAIL = process.env.FROM_EMAIL || 'Healthcare System <onboarding@resend.dev>';

interface EmailParams {
  to: string;
  subject: string;
  html: string;
}

interface AppointmentEmailParams {
  to: string;
  patientName: string;
  doctorName: string;
  date: Date;
  startTime: string;
  endTime: string;
  appointmentId: string;
}

export const sendEmail = async ({ to, subject, html }: EmailParams): Promise<boolean> => {
  try {
    console.log('📧 Attempting to send email to:', to);
    console.log('📧 Subject:', subject);

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to], // Ensure this is an array
      subject: subject,
      html: html
    });

    if (error) {
      console.error('❌ Resend API error:', error);
      logger.error('Resend API error:', error);
      return false;
    }

    console.log('✅ Email sent successfully:', data);
    logger.info(`Email sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending email:', error);
    logger.error('Error sending email:', error);
    return false;
  }
};

export const sendAppointmentConfirmation = async (params: AppointmentEmailParams) => {
  const { to, patientName, doctorName, date, startTime, endTime, appointmentId } = params;
  
  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { background: #2563eb; color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .details { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb; }
        .footer { background: #f1f5f9; padding: 20px; text-align: center; color: #64748b; font-size: 14px; }
        .appointment-id { background: #e2e8f0; padding: 8px 12px; border-radius: 4px; font-family: monospace; font-weight: bold; }
        .info-item { margin: 10px 0; }
        .info-label { font-weight: bold; color: #475569; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Appointment Confirmed! 🎉</h1>
        </div>
        <div class="content">
          <p>Dear <strong>${patientName}</strong>,</p>
          <p>Your appointment has been successfully booked with our healthcare system. Here are your appointment details:</p>
          
          <div class="details">
            <div class="info-item">
              <span class="info-label">Appointment ID:</span>
              <span class="appointment-id">${appointmentId}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Doctor:</span>
              <span>Dr. ${doctorName}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Date:</span>
              <span>${formattedDate}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Time:</span>
              <span>${startTime} - ${endTime}</span>
            </div>
          </div>
          
          <p><strong>Important Instructions:</strong></p>
          <ul>
            <li>Please arrive 10-15 minutes before your scheduled time</li>
            <li>Bring your ID and any relevant medical records</li>
            <li>If you need to cancel or reschedule, please contact us at least 24 hours in advance</li>
          </ul>
          
          <p>If you have any questions, please don't hesitate to contact us.</p>
          
          <p>Best regards,<br><strong>The Healthcare Team</strong></p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>If you believe this email was sent by mistake, please ignore it.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const emailSent = await sendEmail({
    to: to,
    subject: `Appointment Confirmation - ${appointmentId}`,
    html: html
  });

  if (!emailSent) {
    console.error(`❌ Failed to send confirmation email to ${to}`);
    // You might want to implement a retry mechanism here
  }

  return emailSent;
};

export const sendAppointmentCancellation = async (params: AppointmentEmailParams) => {
  const { to, patientName, doctorName, date, startTime, endTime, appointmentId } = params;
  
  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        .header { background: #dc2626; color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; }
        .details { background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626; }
        .footer { background: #f1f5f9; padding: 20px; text-align: center; color: #64748b; font-size: 14px; }
        .appointment-id { background: #fecaca; padding: 8px 12px; border-radius: 4px; font-family: monospace; font-weight: bold; }
        .info-item { margin: 10px 0; }
        .info-label { font-weight: bold; color: #475569; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Appointment Cancelled</h1>
        </div>
        <div class="content">
          <p>Dear <strong>${patientName}</strong>,</p>
          <p>Your appointment has been cancelled. Here are the details of the cancelled appointment:</p>
          
          <div class="details">
            <div class="info-item">
              <span class="info-label">Appointment ID:</span>
              <span class="appointment-id">${appointmentId}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Doctor:</span>
              <span>Dr. ${doctorName}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Date:</span>
              <span>${formattedDate}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Time:</span>
              <span>${startTime} - ${endTime}</span>
            </div>
          </div>
          
          <p>If this was a mistake or you'd like to reschedule, please contact us as soon as possible.</p>
          
          <p>Best regards,<br><strong>The Healthcare Team</strong></p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: `Appointment Cancellation - ${appointmentId}`,
    html
  });
};