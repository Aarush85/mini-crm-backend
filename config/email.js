import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Debug: Log environment variables (remove in production)
console.log('SMTP Configuration:', {
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS ? '****' : 'not set',
  fromName: process.env.EMAIL_FROM_NAME,
  fromAddress: process.env.EMAIL_FROM_ADDRESS
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify transporter configuration
transporter.verify(function (error, success) {
  if (error) {
    console.error('SMTP Configuration Error:', error);
  } else {
    console.log('SMTP Server is ready to take our messages');
  }
});

export const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
      to,
      subject,
      text,
      html,
    };

    console.log('Attempting to send email to:', to);
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email sending failed:', error);
    console.error('Error details:', {
      code: error.code,
      command: error.command,
      responseCode: error.responseCode,
      response: error.response,
    });
    return { success: false, error: error.message };
  }
}; 