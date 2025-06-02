# Marketing Campaign Manager - Backend

This is the backend server for the Marketing Campaign Manager application, built with Node.js, Express, and MongoDB.

## Features

- **Customer Management**
  - CRUD operations for customer profiles
  - Track customer spending and order history
  - Customer segmentation based on various criteria
  - Bulk customer import via CSV

- **Order Management**
  - Track customer orders and purchase history
  - Calculate total spending per customer
  - Bulk order import via CSV

- **Campaign Management**
  - Create and manage marketing campaigns
  - AI-powered message generation for campaigns
  - Target audience segmentation
  - Campaign performance tracking

- **Authentication & Authorization**
  - JWT-based authentication
  - Role-based access control
  - Secure password handling

## Tech Stack

- Node.js
- Express.js
- MongoDB with Mongoose
- JWT for authentication
- Zod for request validation
- Hugging Face API for AI message generation

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Hugging Face API key

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
HUGGINGFACE_API_KEY=your_huggingface_api_key
```

## Installation

1. Clone the repository
2. Navigate to the backend directory:
   ```bash
   cd backend
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/status` - Check authentication status

### Customers
- `GET /api/customers` - Get all customers
- `GET /api/customers/:id` - Get single customer
- `POST /api/customers` - Create new customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer
- `POST /api/customers/bulk` - Bulk import customers

### Orders
- `GET /api/orders` - Get all orders
- `GET /api/orders/:id` - Get single order
- `POST /api/orders` - Create new order
- `PUT /api/orders/:id` - Update order
- `DELETE /api/orders/:id` - Delete order
- `POST /api/orders/bulk` - Bulk import orders

### Campaigns
- `GET /api/campaigns` - Get all campaigns
- `GET /api/campaigns/:id` - Get single campaign
- `POST /api/campaigns` - Create new campaign
- `PUT /api/campaigns/:id` - Update campaign
- `DELETE /api/campaigns/:id` - Delete campaign
- `POST /api/campaigns/generate-message` - Generate AI message for campaign

## Error Handling

The API uses a consistent error response format:

```json
{
  "success": false,
  "message": "Error message",
  "errors": [] // Optional array of validation errors
}
```

## Security

- JWT-based authentication
- Password hashing using bcrypt
- Input validation using Zod
- CORS enabled
- Rate limiting
- Environment variable protection 