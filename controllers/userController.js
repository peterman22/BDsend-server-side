var passport = require('passport');
var nodemailer = require('nodemailer');

var authenticate = require('../middleware/auth');
var asyncHandler = require('../middleware/asyncHandler');
var ErrorHandler = require('../utils/error');
var notifications = require('../utils/notifications');

var User = require('../models/users');
var Otp = require('../models/otp');
var Request = require('../models/request');
var Kyc = require('../models/kyc');
var RefreshToken = require('../models/refreshToken');

exports.register = async (req, res, next) => {
	var exists = await User.findOne({ email: req.body.email });
	if (exists) {
		return next(new ErrorHandler('Email already associated with an account', 409));
	}
	try {
		const user = await User.register(
			new User({
				phonenumber: req.body.phonenumber,
				email: req.body.email,
				firstname: req.body.firstname,
				lastname: req.body.lastname,
				dob: req.body.dob,
				country: req.body.country,
			}),
			req.body.password
		);
		await user.save();
		passport.authenticate('local')(req, res, () => {
			res.status(201).json({ success: true, status: 'Registration Successful!' });
		});
		// Fire-and-forget welcome OTP (errors logged by getOtp internally)
		exports.getOtp({ params: { email: req.body.email } }, { status: () => ({ json: () => {} }) }, next);
	} catch (error) {
		return next(error);
	}
};

exports.signIn = asyncHandler(async (req, res) => {
	if (req.body.pin !== req.user.pin) {
		return res.status(401).json({ message: 'Invalid PIN entered.' });
	}
	if (!req.user.active) {
		return res.status(403).json({ message: 'Account is deactivated. Contact support.' });
	}
	const token = authenticate.getToken({ _id: req.user._id });
	const refreshToken = await authenticate.createRefreshToken(req.user._id);
	res.status(200).json({ success: true, token, refreshToken, user: req.user._id });
});

exports.refreshToken = asyncHandler(async (req, res) => {
	const { refreshToken } = req.body;
	if (!refreshToken) {
		return res.status(400).json({ message: 'Refresh token required.' });
	}
	const stored = await RefreshToken.findOne({ token: refreshToken });
	if (!stored || stored.revoked || stored.expiresAt < new Date()) {
		return res.status(401).json({ message: 'Invalid or expired refresh token.' });
	}
	// Rotate: revoke old, issue new pair
	await authenticate.revokeRefreshToken(refreshToken);
	const newAccessToken = authenticate.getToken({ _id: stored.user });
	const newRefreshToken = await authenticate.createRefreshToken(stored.user);
	res.status(200).json({ token: newAccessToken, refreshToken: newRefreshToken });
});

exports.signOut = asyncHandler(async (req, res) => {
	const { refreshToken } = req.body;
	if (refreshToken) {
		await authenticate.revokeRefreshToken(refreshToken);
	}
	res.status(200).json({ message: 'Signed out successfully.' });
});

exports.getUser = asyncHandler(async (req, res) => {
	res.json({ user: req.user });
});

exports.addPin = asyncHandler(async (req, res) => {
	const doc = await User.findOne({ email: req.params.email });
	if (!doc) {
		return res.status(404).json({ message: 'User does not exist.' });
	}
	await User.findByIdAndUpdate(doc._id, { pin: req.body.pin });
	res.status(200).json({ message: 'PIN set successfully.' });
});

exports.getOtp = asyncHandler(async (req, res, next) => {
	const exists = await User.findOne({ email: req.params.email });
	if (!exists) {
		return next(new ErrorHandler('Email does not exist', 404));
	}
	await Otp.deleteOne({ email: req.params.email });
	const code = Math.floor(1000 + Math.random() * 9000).toString();
	await Otp.create({ token: code, email: req.params.email });

	let transport = nodemailer.createTransport({
		host: 'smtp.gmail.com',
		port: 465,
		secure: true,
		auth: { user: process.env.EMAIL, pass: process.env.EMAIL_PASSWORD },
	});
	transport.sendMail(
		{
			from: process.env.EMAIL,
			to: req.params.email,
			subject: 'BDsend OTP Verification',
			text: `Your verification code is: ${code}. It expires in 1 hour.`,
		},
		(err) => {
			if (err) return next(new ErrorHandler('Failed to send OTP email', 500));
			if (res && typeof res.status === 'function') res.status(200).json();
		}
	);
});

exports.verifyOtp = asyncHandler(async (req, res) => {
	const doc = await Otp.findOne({ email: req.params.email });
	if (doc && req.params.otp === doc.token) {
		await Otp.deleteOne({ email: req.params.email });
		return res.status(200).json({ message: 'Email verified successfully.' });
	}
	res.status(404).json({ message: 'Invalid or expired token.' });
});

exports.passwordReset = asyncHandler(async (req, res, next) => {
	const user = await User.findOne({ email: req.body.email });
	if (!user) return next(new ErrorHandler('User not found', 404));
	const updated = await user.setPassword(req.body.password);
	await updated.save();
	res.status(200).json({ message: 'Password reset successfully.' });
});

exports.editUser = asyncHandler(async (req, res) => {
	const update = {
		phonenumber: req.body.phonenumber,
		email: req.body.email,
		firstname: req.body.firstname,
		lastname: req.body.lastname,
		address: req.body.address,
		picture: req.body.picture,
	};
	await User.findByIdAndUpdate(req.user._id, update);
	res.status(204).json();
});

exports.changePin = asyncHandler(async (req, res) => {
	if (req.user.pin !== req.body.oldpin) {
		return res.status(400).json({ message: 'Invalid current PIN.' });
	}
	await User.findByIdAndUpdate(req.user._id, { pin: req.body.newpin });
	res.status(204).json();
});

exports.passwordChange = asyncHandler(async (req, res, next) => {
	const user = await User.findById(req.user._id);
	const updated = await user.setPassword(req.body.new_password);
	await updated.save();
	res.status(204).json();
});

exports.verifyPin = asyncHandler(async (req, res) => {
	if (req.params.pin === req.user.pin) {
		return res.status(200).json({ message: 'PIN verified successfully.' });
	}
	res.status(400).json({ message: 'Wrong PIN entered.' });
});

exports.updateWallet = asyncHandler(async (req, res) => {
	const amount = JSON.parse(req.params.amount);
	await User.findByIdAndUpdate(req.user._id, {
		$inc: { wallet: amount, totaldeposit: amount },
	});
	res.status(204).json();
});

exports.updateWalletDeduct = asyncHandler(async (req, res) => {
	const amount = JSON.parse(req.params.amount);
	await User.findByIdAndUpdate(req.user._id, {
		$inc: { wallet: -amount },
	});
	res.status(204).json();
});

// ── Money Requests ────────────────────────────────────────────────────────────

exports.createRequest = asyncHandler(async (req, res) => {
	const target = await User.findOne({ receivingId: req.body.receiving_id });
	if (!target) {
		return res.status(400).json({ message: 'No such user exists.' });
	}
	if (target._id.equals(req.user._id)) {
		return res.status(400).json({ message: 'Cannot request money from yourself.' });
	}
	await Request.create({
		requested_by: req.user._id,
		requested_from: target._id,
		status: 'pending',
		amount: req.body.amount,
		note: req.body.note || '',
	});
	// Notify the person being asked
	notifications.sendMoneyRequest(
		target.email,
		`${req.user.firstname} ${req.user.lastname}`,
		req.body.amount,
		req.user.currency
	);
	res.status(201).json({ message: 'Request created successfully.' });
});

exports.getRequestsCreated = asyncHandler(async (req, res) => {
	const requests = await Request.find({ requested_by: req.user._id })
		.populate('requested_by')
		.populate('requested_from');
	res.status(200).json({ requests });
});

exports.getRequests = asyncHandler(async (req, res) => {
	const requests = await Request.find({
		requested_from: req.user._id,
		status: 'pending',
	})
		.populate('requested_by')
		.populate('requested_from');
	res.status(200).json({ requests });
});

exports.rejectRequest = asyncHandler(async (req, res) => {
	const request = await Request.findById(req.params.id).populate('requested_by');
	if (!request) return res.status(404).json({ message: 'Request not found.' });
	await Request.findByIdAndUpdate(req.params.id, { status: 'rejected' });
	if (request.requested_by) {
		notifications.sendRequestRejected(
			request.requested_by.email,
			request.amount,
			req.user.currency
		);
	}
	res.status(200).json({ message: 'Request rejected.' });
});

exports.acceptRequest = asyncHandler(async (req, res) => {
	const request = await Request.findById(req.params.id).populate('requested_by');
	if (!request) return res.status(404).json({ message: 'Request not found.' });
	if (req.user.wallet < request.amount) {
		return res.status(400).json({ message: 'Insufficient balance.' });
	}
	await User.findByIdAndUpdate(req.user._id, { $inc: { wallet: -request.amount } });
	await User.findByIdAndUpdate(request.requested_by._id, {
		$inc: { wallet: request.amount },
	});
	await Request.findByIdAndUpdate(req.params.id, { status: 'accepted' });
	// Notify requester their money arrived
	if (request.requested_by) {
		notifications.sendRequestAccepted(
			request.requested_by.email,
			request.amount,
			req.user.currency
		);
	}
	res.status(200).json({ message: 'Request accepted.' });
});

// ── KYC ──────────────────────────────────────────────────────────────────────

exports.submitKyc = asyncHandler(async (req, res, next) => {
	const existing = await Kyc.findOne({ user: req.user._id });
	if (existing && existing.status === 'approved') {
		return res.status(400).json({ message: 'KYC already approved.' });
	}
	const kycData = {
		user: req.user._id,
		idType: req.body.idType,
		idNumber: req.body.idNumber,
		idFront: req.body.idFront,
		idBack: req.body.idBack,
		selfie: req.body.selfie,
		status: 'pending',
	};
	await Kyc.findOneAndUpdate({ user: req.user._id }, kycData, {
		upsert: true,
		new: true,
	});
	await User.findByIdAndUpdate(req.user._id, { kycStatus: 'pending' });
	res.status(201).json({ message: 'KYC submitted successfully. Pending review.' });
});

exports.getKycStatus = asyncHandler(async (req, res) => {
	const kyc = await Kyc.findOne({ user: req.user._id });
	res.status(200).json({ kycStatus: req.user.kycStatus, kyc });
});
