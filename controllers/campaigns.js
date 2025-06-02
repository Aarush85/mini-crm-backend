import { z } from 'zod';
import Campaign from '../models/Campaign.js';
import Customer from '../models/Customer.js';
import mongoose from 'mongoose';

// Validation schemas
const segmentRuleSchema = z.object({
  field: z.enum(['name', 'email', 'phone', 'totalSpendings', 'tags']),
  operator: z.enum([
    'equals',
    'contains',
    'startsWith',
    'endsWith',
    'greaterThan',
    'lessThan',
  ]),
  value: z.union([
    z.string(),
    z.number()
  ]),
  logicOperator: z.enum(['AND', 'OR']).optional(),
});

const campaignSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  segmentRules: z.array(segmentRuleSchema).min(1, 'At least one segment rule is required'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
  scheduledFor: z
    .string()
    .refine(
      val => !val || !isNaN(Date.parse(val)),
      { message: 'Invalid date format for scheduledFor' }
    )
    .optional(),
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
    
    // Convert scheduledFor to ISO string if it exists
    if (validatedData.scheduledFor) {
      validatedData.scheduledFor = new Date(validatedData.scheduledFor).toISOString();
    }

    // Create campaign
    const campaign = await Campaign.create({
      ...validatedData,
      status: validatedData.scheduledFor ? 'scheduled' : 'draft',
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
  const subject = `Special Offer for ${audience}!`;
  const body = `Hello,

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
    1. Be professional yet friendly
    2. Include a clear call to action
    3. Create a sense of urgency
    4. Highlight the exclusive nature of the offer
    5. Be relevant to the customer's location and context (based on audience description)
    6. Include specific product categories if mentioned in the prompt
    
    Format the response as a complete email with subject line and body.`;

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
      console.log('Using fallback message due to API error');
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
    
    // Simulate message delivery (90% success rate)
    let delivered = 0;
    let failed = 0;
    const communicationLog = [];
    
    for (const customer of targetAudience) {
      // Simulate 90% success rate
      const isSuccessful = Math.random() < 0.9;
      const status = isSuccessful ? 'delivered' : 'failed';
      const deliveredAt = isSuccessful ? new Date() : null;
      
      communicationLog.push({
        customerId: customer._id,
        status,
        deliveredAt,
      });
      
      if (isSuccessful) {
        delivered++;
      } else {
        failed++;
      }
    }
    
    // Update campaign
    campaign.status = 'sent';
    campaign.sentAt = new Date();
    campaign.targetAudience = targetAudience.length;
    campaign.delivered = delivered;
    campaign.failed = failed;
    campaign.communicationLog = communicationLog;
    
    await campaign.save();
    
    res.status(200).json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    console.error('Send campaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
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
    console.log('Received payload for preview-audience:', JSON.stringify(req.body, null, 2));
    const { segmentRules } = req.body;
    if (!segmentRules || !Array.isArray(segmentRules) || segmentRules.length === 0) {
      console.log('Invalid or missing segmentRules:', segmentRules);
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