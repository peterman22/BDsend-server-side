var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var JwtStrategy = require('passport-jwt').Strategy;
var ExtractJwt = require('passport-jwt').ExtractJwt;
var jwt = require('jsonwebtoken');
var Admin = require('../models/admin');

passport.serializeUser(Admin.serializeUser());
passport.deserializeUser(Admin.deserializeUser());
passport.use('local-admin', new LocalStrategy(Admin.authenticate()));

exports.getToken = function (user) {
	return jwt.sign(user, process.env.SECRET);
};

var opts = {};
opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
opts.secretOrKey = process.env.SECRET;

passport.use(
	'jwt-admin',
	new JwtStrategy(opts, async (jwt_payload, done) => {
		try {
			const user = await Admin.findOne({ _id: jwt_payload._id });
			if (user) {
				return done(null, user);
			} else {
				return done(null, false);
			}
		} catch (error) {
			return error, false;
		}
	})
);

exports.verifyAdmin = passport.authenticate('jwt-admin', {
	session: false,
});
