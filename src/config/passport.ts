import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from '../prisma';
import generateToken from '../utils/generateToken';
import Logger from './logger';
import { Role } from '@prisma/client';
import dotenv from 'dotenv';
import { userSelect } from '../prisma/selects';
import { CreditPointService } from '../services/creditPoint.service';
import { WelcomeService } from '../services/welcome.service';

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

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: userSelect
    });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK!,
      passReqToCallback: true,
    },
    async (req, _accessToken, _refreshToken, profile, done) => {
      try {
        Logger.info(`Google auth attempt for email: ${profile.emails?.[0]?.value}`);
        const role = (req.query.role as string) || 'USER';
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
          if (!user.googleId) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: { googleId: profile.id }
            });
          }
          if (user.isSuspended) {
            return done(new Error('Account has been suspended'), false);
          }
          if (!user.isVerified && !user.googleId) {
            return done(new Error('Account not verified. Please verify your email first.'), false);
          }

          Logger.info(`User logged in via Google: ${user.email}`);
        } else {
          const fullName = profile.displayName || profile.name?.givenName || 'Google User';
          const avatar = profile.photos?.[0]?.value || null;

          user = await prisma.user.create({
            data: {
              googleId: profile.id,
              email: email,
              fullName: fullName,
              avatar: avatar,
              role: role as Role,
              isVerified: true,
              password: null, 
              location: null,
              phone: null,
            },
          });

          Logger.info(`New user created via Google: ${user.email} with role: ${role}`);

          if (role === Role.VENDOR) {
            try {
              await CreditPointService.awardNewVendorBonus(user.id);
            } catch (error) {
              Logger.error(`Failed to award welcome bonus to ${user.email}:`, error);
            }
          }
          try {
            await WelcomeService.sendWelcomeNotification(user.id, user.role);
          } catch (error) {
            Logger.error(`Failed to send welcome notification to ${user.email}:`, error);
          }
        }

        const token = generateToken({
          id: user.id,
          email: user.email,
        });

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