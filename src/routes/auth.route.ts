import { Router } from 'express';
import passport from 'passport';
import { AuthController } from '../controllers/auth.controller';

const authRouter = Router();
const authController = AuthController.getInstance();

authRouter.post('/register', authController.register.bind(authController));
authRouter.post('/login', authController.login.bind(authController));

authRouter.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

authRouter.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/auth/login' }),
  authController.googleCallback.bind(authController)
);

export { authRouter };
