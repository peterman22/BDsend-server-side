var rateLimit = require('express-rate-limit');

exports.loginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 10,
	message: { message: 'Too many login attempts, please try again after 15 minutes.' },
	standardHeaders: true,
	legacyHeaders: false,
});

exports.otpLimiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	max: 5,
	message: { message: 'Too many OTP requests, please try again after an hour.' },
	standardHeaders: true,
	legacyHeaders: false,
});

exports.transferLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: 10,
	message: { message: 'Too many transfer requests, please slow down.' },
	standardHeaders: true,
	legacyHeaders: false,
});

exports.apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 100,
	message: { message: 'Too many requests, please try again later.' },
	standardHeaders: true,
	legacyHeaders: false,
});
