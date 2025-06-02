import Campaign from '../models/Campaign.js';
import Customer from '../models/Customer.js';
import { sendEmail } from '../config/email.js';

// Helper function to evaluate segment rules
const evaluateSegmentRule = (customer, rule) => {
  const { field, operator, value } = rule;
  const customerValue = customer[field];

  switch (operator) {
    case 'equals':
      return customerValue === value;
    case 'contains':
      return String(customerValue).includes(String(value));
    case 'startsWith':
      return String(customerValue).startsWith(String(value));
    case 'endsWith':
      return String(customerValue).endsWith(String(value));
    case 'greaterThan':
      return Number(customerValue) > Number(value);
    case 'lessThan':
      return Number(customerValue) < Number(value);
    default:
      return false;
  }
};

// Helper function to evaluate all segment rules
const evaluateSegmentRules = (customer, rules) => {
  return rules.every((rule, index) => {
    const result = evaluateSegmentRule(customer, rule);
    if (index === 0) return result;
    return rule.logicOperator === 'AND' ? result : result || evaluateSegmentRule(customer, rules[index - 1]);
  });
};

// Send campaign to matching customers
export const sendCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id);

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    if (campaign.status === 'sent') {
      return res.status(400).json({ message: 'Campaign has already been sent' });
    }

    // Find all customers
    const customers = await Customer.find({});

    // Filter customers based on segment rules
    const matchingCustomers = customers.filter(customer => 
      evaluateSegmentRules(customer, campaign.segmentRules)
    );

    // Update campaign stats
    campaign.targetAudience = matchingCustomers.length;
    campaign.status = 'sent';
    campaign.sentAt = new Date();

    // Send emails to matching customers
    const results = await Promise.all(
      matchingCustomers.map(async (customer) => {
        try {
          // Personalize message
          const personalizedMessage = campaign.message.replace(
            /\{name\}/g,
            customer.name
          );

          // Send email
          const emailResult = await sendEmail({
            to: customer.email,
            subject: campaign.name,
            text: personalizedMessage,
            html: personalizedMessage,
          });

          // Log communication
          campaign.communicationLog.push({
            customerId: customer._id,
            status: emailResult.success ? 'delivered' : 'failed',
            deliveredAt: emailResult.success ? new Date() : null,
          });

          // Update delivery stats
          if (emailResult.success) {
            campaign.delivered += 1;
          } else {
            campaign.failed += 1;
          }

          return { customerId: customer._id, success: emailResult.success };
        } catch (error) {
          console.error(`Failed to send email to ${customer.email}:`, error);
          campaign.communicationLog.push({
            customerId: customer._id,
            status: 'failed',
            deliveredAt: null,
          });
          campaign.failed += 1;
          return { customerId: customer._id, success: false };
        }
      })
    );

    // Save campaign with updated stats
    await campaign.save();

    res.status(200).json({
      message: 'Campaign sent successfully',
      stats: {
        targetAudience: campaign.targetAudience,
        delivered: campaign.delivered,
        failed: campaign.failed,
      },
      results,
    });
  } catch (error) {
    console.error('Error sending campaign:', error);
    res.status(500).json({ message: 'Error sending campaign', error: error.message });
  }
}; 