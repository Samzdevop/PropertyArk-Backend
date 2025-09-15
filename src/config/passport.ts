import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from '../prisma';
import generateToken from '../utils/generateToken';

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