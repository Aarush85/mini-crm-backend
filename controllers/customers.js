import { z } from 'zod';
import { parse } from 'csv-parse';
import fs from 'fs';
import Customer from '../models/Customer.js';
import Order from '../models/Order.js';
import mongoose from 'mongoose';

// Validation schema for a single customer
const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  location: z.string().optional(),
  tags: z.array(z.string()).optional(),
  totalSpendings: z.number().optional(),
});

// Validation schema for bulk customers
const bulkCustomerSchema = z.array(customerSchema).min(1, 'At least one customer is required');

// Get all customers
export const getCustomers = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const sort = req.query.sort || '-createdAt';
    const skip = (page - 1) * limit;
    
    // Build filter object
    let filter = {};
    if (req.query.search) {
      filter = {
        $or: [
          { name: { $regex: req.query.search, $options: 'i' } },
          { email: { $regex: req.query.search, $options: 'i' } },
          { phone: { $regex: req.query.search, $options: 'i' } },
          { location: { $regex: req.query.search, $options: 'i' } },
        ],
      };
    }
    
    // Execute query
    const customers = await Customer.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);
    
    // Calculate total spendings for each customer
    const customersWithSpending = await Promise.all(
      customers.map(async (customer) => {
        const totalSpendings = await getTotalSpendings(customer._id);
        const customerObj = customer.toObject();
        customerObj.totalSpendings = totalSpendings;
        return customerObj;
      })
    );
    
    // Get total count
    const total = await Customer.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      count: total,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
      },
      data: customersWithSpending,
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Get single customer
export const getCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }
    
    // Calculate total spendings
    const totalSpendings = await getTotalSpendings(customer._id);
    const customerObj = customer.toObject();
    customerObj.totalSpendings = totalSpendings;
    
    // Get recent orders
    const recentOrders = await Order.find({ customerId: customer._id })
      .sort('-createdAt')
      .limit(5);
    
    res.status(200).json({
      success: true,
      data: {
        ...customerObj,
        recentOrders,
      },
    });
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Create new customer
export const createCustomer = async (req, res) => {
  try {
    // Validate data
    const validatedData = customerSchema.parse(req.body);
    
    // Check for existing customer with same email
    const existingCustomer = await Customer.findOne({ email: validatedData.email });
    if (existingCustomer) {
      return res.status(400).json({
        success: false,
        message: 'Customer with this email already exists',
      });
    }
    
    // Create customer
    const customer = await Customer.create(validatedData);
    
    res.status(201).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }
    
    console.error('Create customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Update customer
export const updateCustomer = async (req, res) => {
  try {
    // Validate data
    const validatedData = customerSchema.parse(req.body);
    
    // Check for existing customer with same email (except current customer)
    const existingCustomer = await Customer.findOne({ 
      email: validatedData.email,
      _id: { $ne: req.params.id }
    });
    
    if (existingCustomer) {
      return res.status(400).json({
        success: false,
        message: 'Another customer with this email already exists',
      });
    }
    
    // Update customer
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      validatedData,
      { new: true, runValidators: true }
    );
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }
    
    // Calculate total spendings
    const totalSpendings = await getTotalSpendings(customer._id);
    const customerObj = customer.toObject();
    customerObj.totalSpendings = totalSpendings;
    
    res.status(200).json({
      success: true,
      data: customerObj,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }
    
    console.error('Update customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Delete customer
export const deleteCustomer = async (req, res) => {
  try {
    // Check for related orders
    const relatedOrders = await Order.countDocuments({ customerId: req.params.id });
    
    if (relatedOrders > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete customer with existing orders',
      });
    }
    
    const customer = await Customer.findByIdAndDelete(req.params.id);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Helper function to get total spendings
async function getTotalSpendings(customerId) {
  const result = await Order.aggregate([
    {
      $match: { customerId: new mongoose.Types.ObjectId(customerId) }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$price' }
      }
    }
  ]);
  
  return result.length > 0 ? result[0].total : 0;
}

export const createBulkCustomers = async (req, res) => {
  try {
    // Validate the request body
    const customers = bulkCustomerSchema.parse(req.body);

    // Check for duplicate emails
    const emails = customers.map(c => c.email);
    const existingCustomers = await Customer.find({ email: { $in: emails } });
    
    if (existingCustomers.length > 0) {
      const duplicateEmails = existingCustomers.map(c => c.email);
      return res.status(400).json({
        success: false,
        message: 'Some customers already exist',
        duplicates: duplicateEmails,
      });
    }

    // Create all customers in a single operation
    const createdCustomers = await Customer.insertMany(customers, {
      ordered: false, // Continue processing even if some customers fail
    });

    res.status(201).json({
      success: true,
      message: `Successfully created ${createdCustomers.length} customers`,
      data: createdCustomers,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    console.error('Error creating bulk customers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create customers',
      error: error.message,
    });
  }
};

export const bulkUploadCustomers = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded',
    });
  }

  const results = {
    success: 0,
    failed: 0,
    errors: [],
  };

  const parser = fs.createReadStream(req.file.path)
    .pipe(parse({
      columns: true,
      skip_empty_lines: true,
    }));

  try {
    for await (const record of parser) {
      try {
        const customer = await Customer.create({
          name: record.name,
          email: record.email,
          phone: record.phone,
          location: record.location,
          tags: record.tags ? record.tags.split(',').map(tag => tag.trim()) : [],
          notes: record.notes || '',
        });
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(`Row failed: ${record.email} - ${error.message}`);
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during bulk upload',
    });
  }
};