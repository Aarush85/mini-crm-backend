import { sendEmail } from '../config/email.js';

export const sendCampaignEmails = async (campaign, customers) => {
  const BATCH_SIZE = 50;
  const DELAY_BETWEEN_BATCHES = 1000; // 1 second
  let successCount = 0;
  let failureCount = 0;
  const failedEmails = [];

  // Process emails in batches
  for (let i = 0; i < customers.length; i += BATCH_SIZE) {
    const batch = customers.slice(i, i + BATCH_SIZE);
    // console.log(`Processing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(customers.length / BATCH_SIZE)}`); // Comment out unnecessary log

    // Send emails in parallel for this batch
    const results = await Promise.allSettled(
      batch.map(async (customer) => {
        try {
          // Create personalized message with customer's name
          let personalizedMessage = campaign.message.replace(
            /{customername}/gi,
            customer.name ? customer.name.split(' ')[0] : 'Valued Customer' // Use first name or fallback
          );

          // Convert newlines to <br> tags for basic HTML formatting
          personalizedMessage = personalizedMessage.replace(/\n/g, '<br>');

          // Wrap in basic HTML structure
          const htmlBody = `
            <html>
            <head>
              <title>${campaign.subject}</title>
            </head>
            <body>
              ${personalizedMessage}
            </body>
            </html>
          `;

          // Create plain text version by stripping HTML tags
          const plainText = personalizedMessage.replace(/<[^>]*>/g, '');
          
          const result = await sendEmail({
            to: customer.email,
            subject: campaign.subject.replace(
              /{customerFirstName}/gi,
              customer.name ? customer.name.split(' ')[0] : 'Valued Customer'
            ), // Replace first name placeholder in subject
            text: plainText, // Plain text version
            html: htmlBody, // HTML version with personalization and formatting
          });

          if (!result.success) {
            console.error(`Failed to send email to ${customer.email}:`, result.error);
            return { success: false, email: customer.email, error: result.error };
          }

          // console.log(`Email sent successfully: ${result.messageId}`); // Comment out unnecessary log
          return { success: true, email: customer.email, messageId: result.messageId };
        } catch (error) {
          console.error(`Error sending email to ${customer.email}:`, error);
          return { success: false, email: customer.email, error: error.message };
        }
      })
    );

    // Process results
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          successCount++;
        } else {
          failureCount++;
          failedEmails.push({
            email: result.value.email,
            error: result.value.error,
          });
        }
      } else {
        failureCount++;
        failedEmails.push({
          email: 'unknown',
          error: result.reason?.message || 'Unknown error',
        });
      }
    });

    // Add delay between batches if not the last batch
    if (i + BATCH_SIZE < customers.length) {
      // console.log(`Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`); // Comment out unnecessary log
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }

  return {
    total: customers.length,
    successCount,
    failureCount,
    failedEmails,
  };
}; 