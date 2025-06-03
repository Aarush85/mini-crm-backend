# MiniCRM Backend

A robust Node.js backend for the MiniCRM platform, handling customer management, order tracking, and marketing campaigns.

## 🚀 Features

- **Authentication**
  - Google OAuth2.0 integration
  - JWT-based session management
  - Role-based access control

- **Customer Management**
  - CRUD operations for customer profiles
  - Customer segmentation
  - Bulk import via CSV

- **Order Management**
  - Track customer orders
  - Calculate spending metrics
  - Bulk order processing

- **Campaign Management**
  - Create targeted marketing campaigns
  - AI-powered message generation
  - Email campaign scheduling
  - Campaign performance tracking

## 🛠 Tech Stack

- Node.js & Express.js
- MongoDB with Mongoose
- Passport.js for authentication
- Nodemailer for email services
- Hugging Face API for AI features

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Google Cloud Console account (for OAuth)
- Gmail account (for email service)
- Hugging Face API key

## ⚙️ Environment Setup

Create a `.env` file in the root directory:

```env
# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Database
MONGODB_URI=mongodb://localhost:27017/mini-crm

# Authentication
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Email
SMTP_USER=your_gmail_username
SMTP_PASS=your_gmail_app_password
EMAIL_FROM_NAME=MiniCRM
EMAIL_FROM_ADDRESS=your_email@gmail.com

# AI Integration
HUGGINGFACE_API_KEY=your_huggingface_api_key
```

## 🚀 Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables
4. Start the server:
   ```bash
   npm run dev
   ```

## 📚 API Documentation

### Authentication
- `POST /api/auth/google` - Google OAuth login
- `GET /api/auth/status` - Check auth status
- `GET /api/auth/logout` - Logout user

### Customers
- `GET /api/customers` - List customers
- `POST /api/customers` - Create customer
- `POST /api/customers/bulk-upload` - Bulk import

### Orders
- `GET /api/orders` - List orders
- `POST /api/orders` - Create order
- `POST /api/orders/bulk-upload` - Bulk import

### Campaigns
- `GET /api/campaigns` - List campaigns
- `POST /api/campaigns` - Create campaign
- `POST /api/campaigns/:id/send` - Send campaign
- `POST /api/campaigns/generate-message` - AI message generation

## 🔒 Security

- Rate limiting
- CORS protection
- Helmet security headers
- JWT authentication
- Secure session management

## 🧪 Testing

```bash
npm test
```

## 📝 License

MIT 