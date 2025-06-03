import { sendCampaignEmails } from './services/emailService.js';

// Test campaign object
const testCampaign = {
  subject: 'Test Campaign Email',
  message: `
    <h1>Test Campaign Email</h1>
    <p>This is a test email sent using the emailService.</p>
    <p>If you're receiving this email, your email service is working correctly!</p>
    <hr>
    <p><strong>Test Details:</strong></p>
    <ul>
      <li>Sent at: ${new Date().toLocaleString()}</li>
      <li>From: ${process.env.EMAIL_FROM_NAME} (${process.env.EMAIL_FROM_ADDRESS})</li>
    </ul>
  `
};

// Test customer
const testCustomer = {
  email: 'aarushkaura2016@gmail.com', // Replace with your email
  name: 'Test User'
};

// Send test email
console.log('Sending test email...');
sendCampaignEmails(testCampaign, [testCustomer])
  .then(results => {
    console.log('Email sending results:', results);
  })
  .catch(error => {
    console.error('Error sending email:', error);
  }); 