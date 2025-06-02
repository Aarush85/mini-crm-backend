import mongoose from 'mongoose';

const OrderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: [true, 'Please provide order ID'],
      unique: true,
      trim: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Please provide customer ID'],
    },
    items: [{
      name: {
        type: String,
        required: [true, 'Please provide item name'],
      },
      quantity: {
        type: Number,
        required: [true, 'Please provide item quantity'],
        min: [1, 'Quantity must be at least 1'],
      },
      price: {
        type: Number,
        required: [true, 'Please provide item price'],
        min: [0, 'Price cannot be negative'],
      }
    }],
    price: {
      type: Number,
      required: [true, 'Please provide order price'],
      min: [0, 'Price cannot be negative'],
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'cancelled'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      default: '',
    },
    shippingAddress: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Auto-populate customer information
OrderSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'customerId',
    select: 'name email',
  });
  next();
});

// Update customer's totalSpendings when an order is created or updated
OrderSchema.post('save', async function() {
  await this.model('Customer').calculateTotalSpendings(this.customerId);
});

// Update customer's totalSpendings when an order is deleted
OrderSchema.post('remove', async function() {
  await this.model('Customer').calculateTotalSpendings(this.customerId);
});

const Order = mongoose.model('Order', OrderSchema);

export default Order;