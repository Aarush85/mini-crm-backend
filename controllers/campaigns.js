import { z } from 'zod';
import Campaign from '../models/Campaign.js';
import Customer from '../models/Customer.js';
import { sendCampaignEmails } from '../services/emailService.js';
import { sendEmail } from '../config/email.js';
import mongoose from 'mongoose';

// Validation schemas
const segmentRuleSchema = z.object({
  field: z.enum(['name', 'email', 'phone', 'location', 'totalSpendings', 'tags']),
  operator: z.enum(['equals', 'contains', 'startsWith', 'endsWith', 'greaterThan', 'lessThan']),
  value: z.union([z.string(), z.number()]),
  logicOperator: z.enum(['AND', 'OR']).optional(),
});

const campaignSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  segmentRules: z.array(segmentRuleSchema).min(1, 'At least one segment rule is required'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
  scheduledFor: z.string().datetime().optional(),
});

// Get all campaigns
export const getCampaigns = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const sort = req.query.sort || '-createdAt';
    const skip = (page - 1) * limit;
    
    // Build filter object
    let filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    
    if (req.query.search) {
      filter = {
        ...filter,
        $or: [
          { name: { $regex: req.query.search, $options: 'i' } },
          { description: { $regex: req.query.search, $options: 'i' } },
        ],
      };
    }
    
    // Execute query
    const campaigns = await Campaign.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);
    
    // Get total count
    const total = await Campaign.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      count: total,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
      },
      data: campaigns,
    });
  } catch (error) {
    console.error('Get campaigns error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Get single campaign
export const getCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    console.error('Get campaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Create new campaign
export const createCampaign = async (req, res) => {
  try {
    // Validate data
    const validatedData = campaignSchema.parse(req.body);
    
    // Extract subject from message
    const messageContent = validatedData.message;
    let subject = 'Default Subject'; // Fallback subject
    let body = messageContent;

    const subjectMatch = messageContent.match(/^Subject:\s*(.+)\n\n([\s\S]*)$/);
    if (subjectMatch && subjectMatch[1] && subjectMatch[2]) {
      subject = subjectMatch[1].trim();
      body = subjectMatch[2].trim();
    } else {
      // If no subject found in message, use the first few words as subject
      subject = messageContent.substring(0, 50).trim() + '(...)';
      console.warn('Could not extract subject from message. Using fallback.', messageContent);
    }

    
    // Create campaign
    const campaign = await Campaign.create({
      name: validatedData.name,
      description: validatedData.description,
      subject: subject, // Save extracted subject
      segmentRules: validatedData.segmentRules,
      message: body, // Save extracted body
      status: validatedData.scheduledFor ? 'scheduled' : 'draft',
      scheduledFor: validatedData.scheduledFor
    });
    
    // Calculate target audience
    const targetAudience = await calculateTargetAudience(campaign.segmentRules);
    
    // Update campaign with target audience count
    campaign.targetAudience = targetAudience.length;
    await campaign.save();
    
    res.status(201).json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }
    
    console.error('Create campaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Helper function to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to generate a fallback message
const generateFallbackMessage = (prompt, audience) => {
  const subject = `{customerFirstName} Don't Forget What's Waiting for You!`;
  const body = `Dear {customername},

${prompt}

This exclusive offer is available for a limited time only.

Best regards,
The Team`;
  
  return `Subject: ${subject}\n\n${body}`;
};

// Generate message with Hugging Face
export const generateMessage = async (req, res) => {
  try {
    const { prompt, audience, customerName } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: 'Prompt is required',
      });
    }

    const systemPrompt = `You are a marketing expert creating personalized campaign messages.
    The target audience consists of customers with the following characteristics: ${audience}.
    
    Create a concise, engaging message that would resonate with this audience.
    The message should:
    1. Start with "Dear {customername}" for personalization
    2. Be professional yet friendly
    3. Include a clear call to action
    4. Create a sense of urgency
    5. Highlight the exclusive nature of the offer
    6. Be relevant to the customer's location and context (based on audience description)
    7. Include specific product categories if mentioned in the prompt
    8. Format the email body using HTML tags (e.g., <p>, <br>, <strong>)
    
    Format the response as a complete email with subject line and HTML body. Make sure the body is valid HTML.
    
    The subject line should be attention-grabbing, concise, and specific to the campaign's topic and target audience based on the provided context.

    For example:

Subject: Something exciting just arrived – and it's only for you!

<p>Dear {customername},</p>

<p>We have a special offer just for you...</p>

<p>Click here to learn more: <a href="YOUR_LINK">Shop Now</a></p>

<p>Best regards,<br>The Team</p>`;

    try {
      const response = await fetch(
        "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
        {
          headers: {
            "Authorization": `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            "Content-Type": "application/json",
          },
          method: "POST",
          body: JSON.stringify({
            inputs: `<s>[INST] ${systemPrompt}\n\nCampaign Context: ${prompt} [/INST]`,
            parameters: {
              max_new_tokens: 250,
              temperature: 0.7,
              top_p: 0.95,
              repetition_penalty: 1.1,
              return_full_text: false
            }
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Hugging Face API error: ${response.statusText}`);
      }

      const result = await response.json();
      const generatedMessage = result[0].generated_text.split('[/INST]').pop().trim();
      
      res.status(200).json({
        success: true,
        data: { message: generatedMessage },
      });
    } catch (error) {
      console.error('Hugging Face API error:', error);
      // Use fallback message if API fails
      const fallbackMessage = generateFallbackMessage(prompt, audience);
      
      res.status(200).json({
        success: true,
        data: {
          message: fallbackMessage,
          note: 'Using fallback message due to API error'
        },
      });
    }
  } catch (error) {
    console.error('Generate message error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate message',
      details: error.stack
    });
  }
};

// Update campaign
export const updateCampaign = async (req, res) => {
  try {
    // Validate data
    const validatedData = campaignSchema.parse(req.body);
    
    // Check if campaign exists
    const existingCampaign = await Campaign.findById(req.params.id);
    if (!existingCampaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found',
      });
    }
    
    // Prevent updates to sent campaigns
    if (existingCampaign.status === 'sent') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update a campaign that has already been sent',
      });
    }
    
    // Update campaign
    const campaign = await Campaign.findByIdAndUpdate(
      req.params.id,
      {
        ...validatedData,
        status: validatedData.scheduledFor ? 'scheduled' : 'draft',
      },
      { new: true, runValidators: true }
    );
    
    // Recalculate target audience
    const targetAudience = await calculateTargetAudience(campaign.segmentRules);
    
    // Update campaign with target audience count
    campaign.targetAudience = targetAudience.length;
    await campaign.save();
    
    res.status(200).json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }
    
    console.error('Update campaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Send campaign
export const sendCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found',
      });
    }
    
    if (campaign.status === 'sent') {
      return res.status(400).json({
        success: false,
        message: 'Campaign has already been sent',
      });
    }
    
    // Get target audience
    const targetAudience = await calculateTargetAudience(campaign.segmentRules);
    
    if (targetAudience.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No target audience found for this campaign',
      });
    }
    
    // Send emails
    const emailResults = await sendCampaignEmails(campaign, targetAudience);
    
    // Update campaign status
    campaign.status = 'sent';
    campaign.sentAt = new Date();
    campaign.targetAudience = targetAudience.length;
    campaign.delivered = emailResults.successCount;
    campaign.failed = emailResults.failureCount;
    campaign.communicationLog = targetAudience.map(customer => ({
      customerId: customer._id,
      status: emailResults.failedEmails.some(failed => failed.email === customer.email) ? 'failed' : 'delivered',
      deliveredAt: emailResults.failedEmails.some(failed => failed.email === customer.email) ? null : new Date(),
    }));
    
    await campaign.save();
    
    res.status(200).json({
      success: true,
      data: {
        campaignId: campaign._id,
        successCount: emailResults.successCount,
        failureCount: emailResults.failureCount,
        failedEmails: emailResults.failedEmails,
      },
    });
  } catch (error) {
    console.error('Send campaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send campaign',
      error: error.message,
    });
  }
};

// Delete campaign
export const deleteCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found',
      });
    }
    
    if (campaign.status === 'sent') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a campaign that has already been sent',
      });
    }
    
    await Campaign.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Preview campaign audience
export const previewCampaignAudience = async (req, res) => {
  try {
    const { segmentRules } = req.body;
    
    if (!segmentRules || !Array.isArray(segmentRules) || segmentRules.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Segment rules are required',
      });
    }
    
    // Calculate target audience
    const targetAudience = await calculateTargetAudience(segmentRules);
    
    res.status(200).json({
      success: true,
      data: {
        count: targetAudience.length,
        audience: targetAudience.map(customer => ({
          id: customer._id,
          name: customer.name,
          email: customer.email,
        })),
      },
    });
  } catch (error) {
    console.error('Preview campaign audience error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Helper function to calculate target audience based on segment rules
async function calculateTargetAudience(segmentRules) {
  // Build MongoDB query from segment rules
  let mongoQuery = { $and: [] };
  let currentGroup = { $or: [] };
  let isUsingOr = false;
  
  for (let i = 0; i < segmentRules.length; i++) {
    const rule = segmentRules[i];
    let condition = {};
    
    switch (rule.field) {
      case 'name':
      case 'email':
      case 'phone':
      case 'location':
        condition = buildStringCondition(rule.field, rule.operator, rule.value);
        break;
        
      case 'totalSpendings':
        // Handle this separately as it requires aggregation
        continue;
        
      case 'tags':
        condition = { tags: { $in: [rule.value] } };
        break;
    }
    
    if (i > 0 && rule.logicOperator === 'OR') {
      isUsingOr = true;
      currentGroup.$or.push(condition);
    } else {
      if (isUsingOr && currentGroup.$or.length > 0) {
        mongoQuery.$and.push(currentGroup);
        currentGroup = { $or: [] };
        isUsingOr = false;
      }
      
      if (rule.logicOperator === 'OR' && i < segmentRules.length - 1) {
        isUsingOr = true;
        currentGroup.$or.push(condition);
      } else {
        mongoQuery.$and.push(condition);
      }
    }
  }
  
  if (isUsingOr && currentGroup.$or.length > 0) {
    mongoQuery.$and.push(currentGroup);
  }
  
  if (mongoQuery.$and.length === 0) {
    mongoQuery = {};
  }
  
  // Get customers matching the query
  const customers = await Customer.find(mongoQuery);
  
  // Filter by totalSpendings if needed
  const spendingRules = segmentRules.filter(rule => rule.field === 'totalSpendings');
  
  if (spendingRules.length > 0) {
    const filteredCustomers = [];
    
    for (const customer of customers) {
      const totalSpendings = await Customer.calculateTotalSpendings(customer._id);
      
      let includeCustomer = true;
      for (const rule of spendingRules) {
        switch (rule.operator) {
          case 'equals':
            if (totalSpendings !== parseFloat(rule.value)) includeCustomer = false;
            break;
          case 'greaterThan':
            if (totalSpendings <= parseFloat(rule.value)) includeCustomer = false;
            break;
          case 'lessThan':
            if (totalSpendings >= parseFloat(rule.value)) includeCustomer = false;
            break;
        }
        
        if (!includeCustomer) break;
      }
      
      if (includeCustomer) {
        filteredCustomers.push(customer);
      }
    }
    
    return filteredCustomers;
  }
  
  return customers;
}

// Helper function to build string conditions
function buildStringCondition(field, operator, value) {
  switch (operator) {
    case 'equals':
      return { [field]: value };
    case 'contains':
      return { [field]: { $regex: value, $options: 'i' } };
    case 'startsWith':
      return { [field]: { $regex: `^${value}`, $options: 'i' } };
    case 'endsWith':
      return { [field]: { $regex: `${value}$`, $options: 'i' } };
    default:
      return { [field]: value };
  }
}

// Helper function to build number conditions
function buildNumberCondition(field, operator, value) {
  const numValue = parseFloat(value);
  if (isNaN(numValue)) {
    // Handle invalid number value (optional: throw error or return empty condition)
    console.error(`Invalid number value for field ${field}: ${value}`);
    return {}; // Return an empty condition
  }
  
  switch (operator) {
    case 'equals':
      return { [field]: numValue };
    case 'greaterThan':
      return { [field]: { $gt: numValue } };
    case 'lessThan':
      return { [field]: { $lt: numValue } };
      // You might add other number operators like $gte, $lte if needed
    default:
      console.error(`Unsupported operator for number field ${field}: ${operator}`);
      return {}; // Return an empty condition
  }
}

// Test email endpoint
export const testEmail = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required',
      });
    }

    const testMessage = `
      <h1>Test Email</h1>
      <p>This is a test email to verify the email service configuration.</p>
      <p>If you're receiving this email, your email service is working correctly!</p>
      <hr>
      <p><strong>Test Details:</strong></p>
      <ul>
        <li>Sent at: ${new Date().toLocaleString()}</li>
        <li>From: ${process.env.EMAIL_FROM_NAME} (${process.env.EMAIL_FROM_ADDRESS})</li>
      </ul>
    `;

    const result = await sendEmail({
      to: email,
      subject: 'Test Email from Campaign System',
      text: 'This is a test email to verify the email service configuration.',
      html: testMessage,
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send test email',
        error: result.error,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Test email sent successfully',
      messageId: result.messageId,
    });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test email',
      error: error.message,
    });
  }
};