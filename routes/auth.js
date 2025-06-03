import express from 'express';
import passport from 'passport';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

// Google OAuth login route
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth callback route
router.get('/google/callback', 
  passport.authenticate('google', { 
    failureRedirect: `${process.env.FRONTEND_URL}/login`,
    successRedirect: `${process.env.FRONTEND_URL}/`
  })
);

// Check authentication status
router.get('/status', (req, res) => {
  if (req.isAuthenticated()) {
    return res.status(200).json({
      isAuthenticated: true,
      user: {
        id: req.user._id,
        name: req.user.displayName,
        email: req.user.email,
        avatar: req.user.avatar
      }
    });
  }
  res.status(200).json({ isAuthenticated: false });
});

// Logout route
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Error during logout' });
    }
    res.status(200).json({ message: 'Logout successful' });
  });
});

export default router;
