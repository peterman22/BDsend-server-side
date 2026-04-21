var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var JwtStrategy = require('passport-jwt').Strategy;
var ExtractJwt = require('passport-jwt').ExtractJwt;
var jwt = require('jsonwebtoken');
var crypto = require('crypto');
var User = require('../models/users');
var RefreshToken = require('../models/refreshToken');

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
passport.use(new LocalStrategy({ usernameField: 'email' }, User.authenticate()));

// Access token expires in 15 minutes
exports.getToken = function (user) {
	return jwt.sign(user, process.env.SECRET, { expiresIn: '15m' });
};

// Refresh token: random opaque string, stored in DB, expires in 7 days
exports.createRefreshToken = async function (userId) {
	const token = crypto.randomBytes(40).toString('hex');
	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
	await RefreshToken.create({ user: userId, token, expiresAt });
	return token;
};

exports.revokeRefreshToken = async function (token) {
	await RefreshToken.findOneAndUpdate({ token }, { revoked: true });
};

var opts = {};
opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
opts.secretOrKey = process.env.SECRET;

passport.use(
	new JwtStrategy(opts, async (jwt_payload, done) => {
		try {
			const user = await User.findOne({ _id: jwt_payload._id });
			if (user) return done(null, user);
			return done(null, false);
		} catch (error) {
			return done(error, false);
		}
	})
);

exports.verifyUser = passport.authenticate('jwt', { session: false });
