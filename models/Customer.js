import mongoose from 'mongoose';

const CustomerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide customer name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide customer email'],
      unique: true,
      match: [
        /^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/,
        'Please provide a valid email',
      ],
      lowercase: true,
    },
    phone: {
      type: String,
      required: [true, 'Please provide customer phone'],
      trim: true,
    },
    location: {
      type: String,
      required: [true, 'Please provide customer location'],
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    notes: {
      type: String,
      default: '',
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for total spendings
CustomerSchema.virtual('totalSpendings').get(function() {
  return 0; // This will be calculated dynamically from orders
});

// Populate total spendings from orders
CustomerSchema.statics.calculateTotalSpendings = async function (customerId) {
  const result = await this.model('Order').aggregate([
    {
      $match: { customerId: new mongoose.Types.ObjectId(customerId) }
    },
    {
      $group: {
        _id: '$customerId',
        totalSpendings: { $sum: '$price' }
      }
    }
  ]);

  return result.length > 0 ? result[0].totalSpendings : 0;
};

const Customer = mongoose.model('Customer', CustomerSchema);

export default Customer;