"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const passport_1 = __importDefault(require("passport"));
const passport_jwt_1 = require("passport-jwt");
const passport_google_oauth20_1 = require("passport-google-oauth20");
const prisma_1 = __importDefault(require("../prisma"));
const generateToken_1 = __importDefault(require("../utils/generateToken"));
const logger_1 = __importDefault(require("./logger"));
const dotenv_1 = __importDefault(require("dotenv"));
const selects_1 = require("../prisma/selects");
dotenv_1.default.config();
passport_1.default.use(new passport_jwt_1.Strategy({
    jwtFromRequest: passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET,
}, async (jwtPayload, done) => {
    try {
        const user = await prisma_1.default.user.findUnique({
            where: { id: jwtPayload.id },
        });
        if (!user)
            return done(null, false);
        return done(null, user);
    }
    catch (err) {
        return done(err, false);
    }
}));
passport_1.default.serializeUser((user, done) => {
    done(null, user.id);
});
passport_1.default.deserializeUser(async (id, done) => {
    try {
        const user = await prisma_1.default.user.findUnique({
            where: { id },
            select: selects_1.userSelect
        });
        done(null, user);
    }
    catch (error) {
        done(error, null);
    }
});
passport_1.default.use(new passport_google_oauth20_1.Strategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK,
    passReqToCallback: true,
}, async (req, _accessToken, _refreshToken, profile, done) => {
    try {
        logger_1.default.info(`Google auth attempt for email: ${profile.emails?.[0]?.value}`);
        // Get role from query parameter (passed from frontend)
        const role = req.query.role || 'USER';
        // Validate role
        if (!['USER', 'VENDOR'].includes(role)) {
            return done(new Error('Invalid role selected'), false);
        }
        const email = profile.emails?.[0]?.value;
        if (!email) {
            return done(new Error('No email found in Google profile'), false);
        }
        let user = await prisma_1.default.user.findFirst({
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
                user = await prisma_1.default.user.update({
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
            logger_1.default.info(`User logged in via Google: ${user.email}`);
        }
        else {
            // Create new user with Google credentials and selected role
            const fullName = profile.displayName || profile.name?.givenName || 'Google User';
            const avatar = profile.photos?.[0]?.value || null;
            user = await prisma_1.default.user.create({
                data: {
                    googleId: profile.id,
                    email: email,
                    fullName: fullName,
                    avatar: avatar,
                    role: role,
                    isVerified: true,
                    password: null,
                    location: null,
                    phone: null,
                },
            });
            logger_1.default.info(`New user created via Google: ${user.email} with role: ${role}`);
        }
        // Generate JWT token
        const token = (0, generateToken_1.default)({
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
    }
    catch (error) {
        logger_1.default.error('Google authentication error:', error);
        return done(error, false);
    }
}));
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
exports.default = passport_1.default;
