var passport = require('passport');
var authenticate = require('../middleware/auth');
var asyncHandler = require('../middleware/asyncHandler');
var ErrorHandler = require('../utils/error');

var User = require('../models/users');
var Admin = require('../models/admin');
var Transaction = require('../models/transaction');
var Rate = require('../models/rate');

exports.register = async (req, res, next) => {
	var exists = await Admin.findOne({
		username: req.body.email,
	});
	if (exists) {
		next(
			new ErrorHandler('Username already associated with an account', 409)
		);
	} else {
		try {
			const user = await Admin.register(
				new Admin({
					username: req.body.username,
				}),
				req.body.password
			);
			if (user) {
				try {
					await user.save();
					passport.authenticate('local-admin')(req, res, () => {
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

exports.editAdmin = asyncHandler(async (req, res, next) => {
	let exists = await Admin.findOne({ username: req.body.username });
	if (exists) {
		if (req.user.id !== exists.id) {
			return res
				.status(409)
				.json({ message: 'Username already associated with an admin' });
		}
	}
	let user = await Admin.findById(req.user._id);
	await Admin.findByIdAndUpdate(req.user.id, {
		username: req.body.username,
	});
	let newUser = await user.setPassword(req.body.password);
	newUser.save();
	res.status(204).json();
});

exports.editUser = asyncHandler(async (req, res) => {
	let update = {
		phonenumber: req.body.phonenumber,
		address: req.body.address,
		fullname: req.body.full_name,
		picture: req.body.picture,
		country: req.body.country,
		wallet: req.body.amount,
	};
	await User.findByIdAndUpdate(req.params.id, update);
	res.status(204).json();
});

exports.editActiveUser = asyncHandler(async (req, res) => {
	let update = {
		active: req.query.active,
	};
	await User.findByIdAndUpdate(req.params.id, update);
	res.status(204).json();
});

exports.getUsers = asyncHandler(async (req, res) => {
	const query = req.query.active || null;
	if (query === null) {
		const allUsers = await User.find({});
		return res.status(200).json(allUsers);
	} else if (query === 'true') {
		const allUsers = await User.find({ active: true });
		return res.status(200).json(allUsers);
	} else {
		const allUsers = await User.find({ active: false });
		return res.status(200).json(allUsers);
	}
});

exports.deleteUser = asyncHandler(async (req, res) => {
	await User.findByIdAndDelete(req.params.id);
	res.status(200).json({ message: 'User deleted successfully' });
});

exports.mainDashboard = asyncHandler(async (req, res) => {
	const totalUsers = await User.countDocuments();
	const totalTransaction = await Transaction.aggregate([
		{ $match: { status: 'Success' } },
		{
			$group: {
				_id: 'none',
				totalAmount: { $sum: '$amount' },
			},
		},
	]);
	const totalDeposit = await User.aggregate([
		{ $match: {} },
		{
			$group: {
				_id: 'none',
				totalAmount: { $sum: '$totaldeposit' },
			},
		},
	]);

	let americans = await User.find({ country: 'USA' });
	let nigerians = await User.find({ country: 'Nigeria' });
	let others = await User.find({ country: { $nin: ['USA', 'Nigeria'] } });
	let amerPer = ((americans.length / totalUsers) * 100).toFixed(2);
	let nigerPer = ((nigerians.length / totalUsers) * 100).toFixed(2);
	let otherPer = ((others.length / totalUsers) * 100).toFixed(2);

	res.status(200).json({
		totalUsers,
		totalTransaction:
			totalTransaction.length > 0 ? totalTransaction[0].totalAmount : 0,
		totalDeposit: totalDeposit.length > 0 ? totalDeposit[0].totalAmount : 0,
		totalWithdrawl: 0,
		american: amerPer,
		nigerian: nigerPer,
		other: otherPer,
	});
});

exports.updateRate = asyncHandler(async (req, res) => {
	await Rate.updateMany({ amount: req.body.amount });
	res.status(202).json({ message: 'Rate updated successfully' });
});

exports.getRate = asyncHandler(async (req, res) => {
	const rate = await Rate.find({});
	res.status(200).json({ rate });
});
