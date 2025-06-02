import mongoose from 'mongoose';

const SegmentRuleSchema = new mongoose.Schema(
  {
    field: {
      type: String,
      enum: ['name', 'email', 'phone', 'location', 'totalSpendings', 'tags'],
      required: true,
    },
    operator: {
      type: String,
      enum: ['equals', 'contains', 'startsWith', 'endsWith', 'greaterThan', 'lessThan'],
      required: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    logicOperator: {
      type: String,
      enum: ['AND', 'OR'],
      default: 'AND',
    },
  },
  { _id: false }
);

const CommunicationLogSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    status: {
      type: String,
      enum: ['delivered', 'failed'],
      required: true,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const CampaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide campaign name'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    segmentRules: {
      type: [SegmentRuleSchema],
      required: [true, 'Please provide segment rules'],
      validate: {
        validator: function(v) {
          return v.length > 0;
        },
        message: 'Campaign must have at least one segment rule',
      },
    },
    message: {
      type: String,
      required: [true, 'Please provide campaign message'],
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'sent', 'failed'],
      default: 'draft',
    },
    scheduledFor: {
      type: Date,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    targetAudience: {
      type: Number,
      default: 0,
    },
    delivered: {
      type: Number,
      default: 0,
    },
    failed: {
      type: Number,
      default: 0,
    },
    communicationLog: {
      type: [CommunicationLogSchema],
      default: [],
    },
  },
  { timestamps: true }
);

const Campaign = mongoose.model('Campaign', CampaignSchema);

export default Campaign;