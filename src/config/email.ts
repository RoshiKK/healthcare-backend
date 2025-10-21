import { Resend } from 'resend';
import logger from '../utils/logger';

const resend = new Resend(process.env.RESEND_API_KEY);

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
  appointmentId: string; // Add this missing property
}

export const sendEmail = async ({ to, subject, html }: EmailParams): Promise<boolean> => {
  try {
    await resend.emails.send({
      from: 'Healthcare System <appointments@healthcare.com>',
      to,
      subject,
      html
    });
    logger.info(`Email sent to ${to}`);
    return true;
  } catch (error) {
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
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { background: #f9fafb; padding: 20px; }
        .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Appointment Confirmation</h1>
        </div>
        <div class="content">
          <p>Dear ${patientName},</p>
          <p>Your appointment has been successfully booked. Here are your appointment details:</p>
          
          <div class="details">
            <p><strong>Appointment ID:</strong> ${appointmentId}</p>
            <p><strong>Doctor:</strong> Dr. ${doctorName}</p>
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Time:</strong> ${startTime} - ${endTime}</p>
          </div>
          
          <p>Please arrive 10 minutes before your scheduled time. If you need to cancel or reschedule, please contact us at least 24 hours in advance.</p>
          
          <p>Best regards,<br>The Healthcare Team</p>
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
    subject: 'Your Appointment Confirmation',
    html
  });
};

export const sendAppointmentCancellation = async (params: AppointmentEmailParams) => {
  const { to, patientName, doctorName, date, startTime, endTime } = params;
  
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
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
        .content { background: #f9fafb; padding: 20px; }
        .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Appointment Cancellation</h1>
        </div>
        <div class="content">
          <p>Dear ${patientName},</p>
          <p>Your appointment has been cancelled. Here are the details of the cancelled appointment:</p>
          
          <div class="details">
            <p><strong>Doctor:</strong> Dr. ${doctorName}</p>
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Time:</strong> ${startTime} - ${endTime}</p>
          </div>
          
          <p>If this was a mistake or you'd like to reschedule, please contact us as soon as possible.</p>
          
          <p>Best regards,<br>The Healthcare Team</p>
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
    subject: 'Appointment Cancellation',
    html
  });
};