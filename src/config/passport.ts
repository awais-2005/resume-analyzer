import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Express } from 'express';
import { User } from '../models/User';

export function initPassport(app: Express): void {
  app.use(passport.initialize());

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: `${process.env.SERVER_URL}/auth/google/callback`,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const picture = profile.photos?.[0]?.value;
          if (!email) {
            return done(new Error('No email found in Google profile'), undefined);
          }

          // profile.id is the unique user id provided by Google.
          let user = await User.findOne({ googleId: profile.id });

          if (!user) {
            // Check if a user with this email already exists (registered via email/password)
            user = await User.findOne({ email });
            if (user) {
              // Link Google account to existing user
              user.googleId = profile.id;
              if (picture) user.picture = picture;
              await user.save();
            } else {
              // Create new user
              user = await User.create({
                email,
                googleId: profile.id,
                picture,
                name: profile.displayName || email,
              });
            }
          } else if (picture && user.picture !== picture) {
            user.picture = picture;
            await user.save();
          }

          return done(null, user);
        } catch (error) {
          return done(error as Error, undefined);
        }
      }
    )
  );
}
