import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User, IUser } from '../models/User';
import { signToken } from '../utils/jwt';
import { ApiError } from '../utils/ApiError';
import { ApiResponse } from '../utils/ApiResponse';
import { HttpStatus } from '../utils/HttpStatus';

export class AuthController {
  private static instance: AuthController;

  public static getInstance(): AuthController {
    if (!AuthController.instance) {
      AuthController.instance = new AuthController();
    }
    return AuthController.instance;
  }

  async register(req: Request, res: Response): Promise<void> {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'Email, password and name are required');
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new ApiError(HttpStatus.CONFLICT, 'User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({ email, password: hashedPassword, name });

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      ...(user.googleId && { googleId: user.googleId }),
    });

    res.status(HttpStatus.CREATED).json(
      new ApiResponse(
        true,
        { token, user: { id: user._id, email: user.email, name: user.name, ...(user.googleId && { googleId: user.googleId }) } },
        'User registered successfully'
      )
    );
  }

  async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'Email and password are required');
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !user.password) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'Invalid email or password');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'Invalid email or password');
    }

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      ...(user.picture && { picture: user.picture }),
      ...(user.googleId && { googleId: user.googleId }),
    });

    res.status(HttpStatus.OK).json(
      new ApiResponse(
        true,
        { token, user: { id: user._id, email: user.email, name: user.name, ...(user.googleId && { googleId: user.googleId }) } },
        'Login successful'
      )
    );
  }

  async googleCallback(req: Request, res: Response): Promise<void> {
    const user = req.user as IUser | undefined;
    if (!user) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, 'Google authentication failed');
    }

    User.findOne({ email: user.email }).then(async (existingUser) => {
      if (!existingUser) {
        const newUser = new User({
          email: user.email,
          name: user.name,
          googleId: user.googleId,
          picture: user.picture,
        });
        await newUser.save();
      }
    });

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      ...(user.picture && { picture: user.picture }),
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  }
}
