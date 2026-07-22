import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from '../prisma';
import generateToken from '../utils/generateToken';
import Logger from './logger';
import { Role } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

passport.use(
	new JwtStrategy(
		{
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			secretOrKey: process.env.JWT_SECRET as string,
		},
		async (jwtPayload, done) => {
			try {
				const user = await prisma.user.findUnique({
					where: { id: jwtPayload.id },
				});
				if (!user) return done(null, false);
				return done(null, user);
			} catch (err) {
				return done(err, false);
			}
		}
	)
);


passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK!,
      passReqToCallback: true,
      state: true,
    },
    async (req, _accessToken, _refreshToken, profile, done) => {
      try {
        Logger.info(`Google auth attempt for email: ${profile.emails?.[0]?.value}`);

        // Get role from query parameter (passed from frontend)
        const role = (req.query.role as string) || 'USER';
        
        // Validate role
        if (!['USER', 'VENDOR'].includes(role)) {
          return done(new Error('Invalid role selected'), false);
        }

        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('No email found in Google profile'), false);
        }

        let user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: email },
              { googleId: profile.id }
            ]
          },
        });

        if (user) {
          // User exists - update googleId if not set
          if (!user.googleId) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: { googleId: profile.id }
            });
          }
          
          // Check if user is suspended
          if (user.isSuspended) {
            return done(new Error('Account has been suspended'), false);
          }

          // Check if user is verified (for non-google users)
          if (!user.isVerified && !user.googleId) {
            return done(new Error('Account not verified. Please verify your email first.'), false);
          }

          Logger.info(`User logged in via Google: ${user.email}`);
        } else {
          // Create new user with Google credentials and selected role
          const fullName = profile.displayName || profile.name?.givenName || 'Google User';
          const avatar = profile.photos?.[0]?.value || null;

          user = await prisma.user.create({
            data: {
              googleId: profile.id,
              email: email,
              fullName: fullName,
              avatar: avatar,
              role: role as Role,
              isVerified: true, // Google users are automatically verified
              password: null, // No password for Google users
              location: null,
              phone: null,
            },
          });

          Logger.info(`New user created via Google: ${user.email} with role: ${role}`);
        }

        // Generate JWT token
        const token = generateToken({
          id: user.id,
          email: user.email,
        });

        // Return user data (exclude sensitive fields)
        const userData = {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          avatar: user.avatar,
          isVerified: user.isVerified,
          googleId: user.googleId,
          createdAt: user.createdAt,
        };

        return done(null, { user: userData, token });
      } catch (error: any) {
        Logger.error('Google authentication error:', error);
        return done(error, false);
      }
    }
  )
);



// passport.use(
// 	new GoogleStrategy(
// 		{
// 			clientID: process.env.GOOGLE_CLIENT_ID!,
// 			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
// 			callbackURL: process.env.GOOGLE_CALLBACK!,
// 		},
// 		async (_accessToken, _refreshToken, profile, done) => {
// 			console.log(profile);
// 			try {
// 				const userObj = {
// 					googleId: profile.id,
// 					email: profile.emails![0].value,
// 					fullName: profile.displayName,
// 				};

// 				let userExist = await prisma.user.findFirst({
// 					where: { OR: [{ email: userObj.email }, { googleId: profile.id }] },
// 				});
// 				let user;
// 				let id: string = userExist?.id || '';
// 				// Don't persist existing users in the database
// 				if (!userExist) {
// 					user = await prisma.user.create({
// 						data: userObj,
// 					});
// 					id = user.id;
// 				} else {
// 					user = userExist;
// 				}

// 				const token = generateToken({ email: userObj.email, id });
// 				return done(null, { user, token });
// 			} catch (err) {
// 				return done(err, false);
// 			}
// 		}
// 	)
// );

export default passport;