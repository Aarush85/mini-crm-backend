import { z } from 'zod';
import { parse } from 'csv-parse';
import fs from 'fs';
import Order from '../models/Order.js';
import Customer from '../models/Customer.js';
import mongoose from 'mongoose';

// Validation schema for a single order
const orderSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  customerId: z.string().min(1, 'Customer ID is required'),
  items: z.array(z.union([
    z.string(),
    z.object({
      name: z.string(),
      quantity: z.number().min(1),
      price: z.number().min(0)
    })
  ])).min(1, 'At least one item is required'),
  price: z.number().min(0, 'Price must be a positive number'),
  status: z.enum(['pending', 'processing', 'completed', 'cancelled']).default('pending'),
  paymentMethod: z.string().optional(),
  shippingAddress: z.string().optional(),
  notes: z.string().optional()
});

// Validation schema for bulk orders
const bulkOrderSchema = z.array(orderSchema).min(1, 'At least one order is required');

// Get all orders
export const getOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const sort = req.query.sort || '-createdAt';
    const skip = (page - 1) * limit;
    
    // Build filter object
    let filter = {};
    if (req.query.customerId) {
      filter.customerId = req.query.customerId;
    }
    
    if (req.query.search) {
      filter = {
        ...filter,
        $or: [
          { orderId: { $regex: req.query.search, $options: 'i' } },
          { items: { $regex: req.query.search, $options: 'i' } },
        ],
      };
    }
    
    // Get orders
    const orders = await Order.find(filter)
      .populate('customerId', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limit);
    
    // Get total count
    const total = await Order.countDocuments(filter);
    
    res.status(200).json({
      success: true,
      count: total,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
      },
      data: orders,
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Get single order
export const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      'customerId',
      'name email phone location'
    );
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Create new order
export const createOrder = async (req, res) => {
  try {
    // Validate data
    const validatedData = orderSchema.parse(req.body);
    
    // Check if customer exists
    const customer = await Customer.findById(validatedData.customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }
    
    // Check for existing order with same orderId
    const existingOrder = await Order.findOne({ orderId: validatedData.orderId });
    if (existingOrder) {
      return res.status(400).json({
        success: false,
        message: 'Order with this ID already exists',
      });
    }
    
    // Create order
    const order = await Order.create(validatedData);
    
    // Populate customer info before returning
    const populatedOrder = await Order.findById(order._id).populate(
      'customerId',
      'name email'
    );
    
    res.status(201).json({
      success: true,
      data: populatedOrder,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }
    
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Update order
export const updateOrder = async (req, res) => {
  try {
    // Validate data
    const validatedData = orderSchema.parse(req.body);
    
    // Check if customer exists
    const customer = await Customer.findById(validatedData.customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }
    
    // Check for existing order with same orderId (except current order)
    const existingOrder = await Order.findOne({
      orderId: validatedData.orderId,
      _id: { $ne: req.params.id },
    });
    
    if (existingOrder) {
      return res.status(400).json({
        success: false,
        message: 'Another order with this ID already exists',
      });
    }
    
    // Update order
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      validatedData,
      { new: true, runValidators: true }
    ).populate('customerId', 'name email');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }
    
    console.error('Update order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Delete order
export const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

export const createBulkOrders = async (req, res) => {
  try {
    console.log('Received request body:', JSON.stringify(req.body, null, 2));

    // Validate the request body
    const orders = bulkOrderSchema.parse(req.body);
    console.log('Validated orders:', JSON.stringify(orders, null, 2));

    // Transform string items into objects if needed
    const transformedOrders = orders.map(order => ({
      ...order,
      items: order.items.map(item => 
        typeof item === 'string' 
          ? { name: item, quantity: 1, price: 0 } 
          : item
      )
    }));
    console.log('Transformed orders:', JSON.stringify(transformedOrders, null, 2));

    // Check for duplicate order IDs
    const orderIds = transformedOrders.map(o => o.orderId);
    const existingOrders = await Order.find({ orderId: { $in: orderIds } });
    
    if (existingOrders.length > 0) {
      const duplicateOrderIds = existingOrders.map(o => o.orderId);
      console.log('Found duplicate order IDs:', duplicateOrderIds);
      return res.status(400).json({
        success: false,
        message: 'Some orders already exist',
        duplicates: duplicateOrderIds,
      });
    }

    // Check if all customers exist
    const customerIds = [...new Set(transformedOrders.map(o => o.customerId))];
    const existingCustomers = await Customer.find({ _id: { $in: customerIds } });
    
    if (existingCustomers.length !== customerIds.length) {
      const existingCustomerIds = existingCustomers.map(c => c._id.toString());
      const missingCustomerIds = customerIds.filter(id => !existingCustomerIds.includes(id));
      console.log('Missing customer IDs:', missingCustomerIds);
      return res.status(404).json({
        success: false,
        message: 'Some customers not found',
        missingCustomers: missingCustomerIds,
      });
    }

    // Create all orders in a single operation
    try {
      const createdOrders = await Order.insertMany(transformedOrders, {
        ordered: false, // Continue processing even if some orders fail
      });
      console.log('Created orders:', JSON.stringify(createdOrders, null, 2));

      // Populate customer info for all created orders
      const populatedOrders = await Order.find({ _id: { $in: createdOrders.map(o => o._id) } })
        .populate('customerId', 'name email');

      res.status(201).json({
        success: true,
        message: `Successfully created ${createdOrders.length} orders`,
        data: populatedOrders,
      });
    } catch (insertError) {
      console.error('Error during Order.insertMany:', insertError);
      if (insertError.writeErrors) {
        // Handle individual write errors
        const errors = insertError.writeErrors.map(err => ({
          orderId: transformedOrders[err.index].orderId,
          error: err.errmsg
        }));
        return res.status(400).json({
          success: false,
          message: 'Some orders failed to create',
          errors
        });
      }
      throw insertError; // Re-throw if it's not a write error
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.errors);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    console.error('Error creating bulk orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create orders',
      error: error.message,
    });
  }
};

export const bulkUploadOrders = async (req, res) => {
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
        // Verify customer exists
        const customer = await Customer.findById(record.customerId);
        if (!customer) {
          throw new Error(`Customer ID ${record.customerId} not found`);
        }

        // Parse items string into array of objects
        const items = record.items.split(',').map(item => ({
          name: item.trim(),
          quantity: 1, // Default quantity
          price: parseFloat(record.price) / record.items.split(',').length // Divide total price by number of items
        }));

        const order = await Order.create({
          orderId: record.orderId,
          customerId: record.customerId,
          items: items,
          price: parseFloat(record.price),
          status: record.status || 'pending',
          paymentMethod: record.paymentMethod,
          shippingAddress: record.shippingAddress,
          notes: record.notes || '',
        });
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(`Row failed: ${record.orderId} - ${error.message}`);
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