var passport = require('passport');
var nodemailer = require('nodemailer');

var authenticate = require('../middleware/auth');
var asyncHandler = require('../middleware/asyncHandler');
var ErrorHandler = require('../utils/error');

var User = require('../models/users');
var Otp = require('../models/otp');
var Request = require('../models/request');

exports.register = async (req, res, next) => {
	var exists = await User.findOne({
		email: req.body.email,
	});
	if (exists) {
		next(new ErrorHandler('Email already associated with an account', 409));
	} else {
		try {
			const user = await User.register(
				new User({
					phonenumber: req.body.phonenumber,
					email: req.body.email,
					fullname: req.body.fullname,
					dob: req.body.dob,
					country: req.body.country,
				}),
				req.body.password
			);
			if (user) {
				try {
					await user.save();
					passport.authenticate('local')(req, res, () => {
						res.status(201).json({
							success: true,
							status: 'Registration Successful!',
						});
					});
				} catch (error) {
					return next(error);
				}
			}
		} catch (error) {
			return next(error);
		}
	}
};

exports.signIn = asyncHandler(async (req, res) => {
	if (req.body.pin !== req.user.pin) {
		return res.status(401).send('Invalid Pin Entered.');
	}
	let token = authenticate.getToken({ _id: req.user._id });
	res.status(200).json({
		success: true,
		token: token,
		user: req.user._id,
	});
});

exports.getUser = asyncHandler(async (req, res) => {
	res.json({ user: req.user });
});

exports.addPin = asyncHandler(async (req, res) => {
	let update = {
		pin: req.body.pin,
	};
	let doc = await User.findOne({ email: req.params.email });
	if (!doc) {
		return res.status(404).json({ message: 'User does not exist.' });
	}
	await User.findByIdAndUpdate(doc._id, update);
	res.status(200).json({ message: 'Pin added successfully.' });
});

exports.getOtp = asyncHandler(async (req, res, next) => {
	var exists = await User.find({ email: req.params.email });
	if (!exists) {
		next(new ErrorHandler('Email does not exist', 404));
	} else {
		var existing = await Otp.find({ email: req.params.email });
		if (existing.length > 0) {
			await Otp.deleteOne({ email: req.params.email });
		}
		var a = Math.floor(1000 + Math.random() * 9000).toString();
		var code = a.substring(-2);
		await Otp.create({ token: code, email: req.params.email });
		let transport = nodemailer.createTransport({
			host: 'smtp.gmail.com',
			port: 465,
			secure: true,
			auth: {
				user: process.env.EMAIL,
				pass: process.env.EMAIL_PASSWORD,
			},
		});
		const mailOptions = {
			from: process.env.EMAIL,
			to: req.params.email,
			subject: 'OTP Verification',
			text: `Your four-digit verification code is: ${code}`,
		};
		transport.sendMail(mailOptions, function (err, info) {
			if (err) {
				next(new ErrorHandler('Internal Server Error', 500));
			} else {
				res.status(200).json();
			}
		});
	}
});

exports.verifyOtp = asyncHandler(async (req, res, next) => {
	let otp = req.params.otp;
	let email = req.params.email;
	let doc = await Otp.findOne({ email: email });
	if (doc && otp === doc.token) {
		await Otp.deleteOne({ email: email });
		res.status(200).json({ message: 'Email verified successfully.' });
	} else {
		res.status(404).json({ message: 'Invalid or Expired token' });
	}
});

exports.passwordReset = asyncHandler(async (req, res, next) => {
	let user = await User.findOne({ email: req.body.email });
	let newUser = await user.setPassword(req.body.password);
	newUser.save();
	res.status(200).json({ message: 'Password reset successfully.' });
});

exports.editUser = asyncHandler(async (req, res) => {
	let update = {
		phonenumber: req.body.phonenumber,
		email: req.body.email,
		fullname: req.body.full_name,
		address: req.body.address,
		picture: req.body.picture,
	};
	await User.findByIdAndUpdate(req.user._id, update);
	res.status(204).json();
});

exports.changePin = asyncHandler(async (req, res) => {
	let update = {
		pin: req.body.newpin,
	};
	if (req.user.pin !== req.body.oldpin) {
		return res.status(404).json({ message: 'Invalid or wrong pin.' });
	}
	await User.findByIdAndUpdate(req.user._id, update);
	res.status(204).json();
});

exports.passwordChange = asyncHandler(async (req, res, next) => {
	let user = await User.findById(req.user._id);
	let newUser = await user.setPassword(req.body.new_password);
	newUser.save();
	res.status(204).json();
});

exports.verifyPin = asyncHandler(async (req, res, next) => {
	let pin = req.params.pin;
	if (pin === req.user.pin) {
		res.status(200).json({ message: 'Pin verified successfully' });
	} else {
		res.status(400).json({ message: 'Wrong Pin Entered.' });
	}
});

exports.updateWallet = asyncHandler(async (req, res) => {
	let update = {
		wallet: req.user.wallet + JSON.parse(req.params.amount),
		totaldeposit: req.user.totaldeposit + JSON.parse(req.params.amount),
	};
	await User.findByIdAndUpdate(req.user._id, update);
	res.status(204).json();
});

exports.updateWalletDeduct = asyncHandler(async (req, res) => {
	let update = {
		wallet: req.user.wallet - JSON.parse(req.params.amount),
	};
	await User.findByIdAndUpdate(req.user._id, update);
	res.status(204).json();
});

exports.createRequest = asyncHandler(async (req, res) => {
	let user = await User.findOne({ receivingId: req.body.receiving_id });
	if (!user) {
		return res.status(400).json({ message: 'No such user exists.' });
	}
	await Request.create({
		requested_by: req.user.id,
		requested_from: user.id,
		status: 'pending',
		amount: req.body.amount,
	});
	res.status(201).json({ message: 'Request created successfully.' });
});

exports.getRequestsCreated = asyncHandler(async (req, res) => {
	let requests = await Request.find({ requested_by: req.user.id })
		.populate('requested_by')
		.populate('requested_from');
	res.status(200).json({ requests });
});

exports.getRequests = asyncHandler(async (req, res) => {
	let requests = await Request.find({
		requested_from: req.user.id,
		status: 'pending',
	})
		.populate('requested_by')
		.populate('requested_from');
	res.status(200).json({ requests });
});

exports.rejectRequest = asyncHandler(async (req, res) => {
	await Request.findByIdAndUpdate(req.params.id, {
		status: 'rejected',
	});
	res.status(200).json({ message: 'Request rejected.' });
});

exports.acceptRequest = asyncHandler(async (req, res) => {
	let request = await Request.findById(req.params.id);
	if (req.user.wallet < request.amount) {
		return res.status(400).json({ message: 'Not enough balance.' });
	}
	await User.findByIdAndUpdate(req.user.id, {
		$inc: { wallet: -request.amount },
	});
	await User.findByIdAndUpdate(request.requested_by, {
		$inc: { wallet: request.amount },
	});
	await Request.findByIdAndUpdate(req.params.id, {
		status: 'accepted',
	});
	res.status(200).json({ message: 'Request accepted.' });
});
