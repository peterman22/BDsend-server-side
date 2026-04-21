var passport = require('passport');
var authenticate = require('../middleware/auth');
var asyncHandler = require('../middleware/asyncHandler');
var ErrorHandler = require('../utils/error');

var User = require('../models/users');
var Admin = require('../models/admin');
var Transaction = require('../models/transaction');
var Rate = require('../models/rate');
var Kyc = require('../models/kyc');
var AuditLog = require('../models/auditLog');

// ── Helpers ───────────────────────────────────────────────────────────────────

function audit(adminId, action, targetType, targetId, details, ip) {
	return AuditLog.create({ admin: adminId, action, targetType, targetId, details, ip });
}

// ── Auth ──────────────────────────────────────────────────────────────────────

exports.register = async (req, res, next) => {
	const exists = await Admin.findOne({ username: req.body.username });
	if (exists) {
		return next(new ErrorHandler('Username already associated with an account', 409));
	}
	try {
		const admin = await Admin.register(
			new Admin({ username: req.body.username }),
			req.body.password
		);
		await admin.save();
		passport.authenticate('local-admin')(req, res, () => {
			res.status(201).json({ success: true, status: 'Registration Successful!' });
		});
	} catch (error) {
		return next(error);
	}
};

exports.signIn = asyncHandler(async (req, res) => {
	const token = authenticate.getToken({ _id: req.user._id });
	res.status(200).json({ success: true, token, user: req.user._id });
});

exports.getUser = asyncHandler(async (req, res) => {
	res.json({ user: req.user });
});

exports.editAdmin = asyncHandler(async (req, res, next) => {
	const exists = await Admin.findOne({ username: req.body.username });
	if (exists && req.user.id !== exists.id) {
		return res.status(409).json({ message: 'Username already taken.' });
	}
	await Admin.findByIdAndUpdate(req.user._id, { username: req.body.username });
	const admin = await Admin.findById(req.user._id);
	const updated = await admin.setPassword(req.body.password);
	await updated.save();
	await audit(req.user._id, 'EDIT_ADMIN_PROFILE', 'Admin', req.user._id, {}, req.ip);
	res.status(204).json();
});

// ── User management ───────────────────────────────────────────────────────────

exports.getUsers = asyncHandler(async (req, res) => {
	const page = Math.max(1, parseInt(req.query.page) || 1);
	const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
	const skip = (page - 1) * limit;

	const filter = {};
	if (req.query.active === 'true') filter.active = true;
	else if (req.query.active === 'false') filter.active = false;

	const [users, total] = await Promise.all([
		User.find(filter).skip(skip).limit(limit),
		User.countDocuments(filter),
	]);

	res.status(200).json({
		users,
		pagination: { page, limit, total, pages: Math.ceil(total / limit) },
	});
});

exports.editUser = asyncHandler(async (req, res) => {
	const update = {
		phonenumber: req.body.phonenumber,
		address: req.body.address,
		firstname: req.body.firstname,
		lastname: req.body.lastname,
		picture: req.body.picture,
		country: req.body.country,
		wallet: req.body.amount,
	};
	await User.findByIdAndUpdate(req.params.id, update);
	await audit(req.user._id, 'EDIT_USER', 'User', req.params.id, update, req.ip);
	res.status(204).json();
});

exports.editActiveUser = asyncHandler(async (req, res) => {
	const active = req.query.active === 'true';
	await User.findByIdAndUpdate(req.params.id, { active });
	await audit(
		req.user._id,
		active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
		'User',
		req.params.id,
		{ active },
		req.ip
	);
	res.status(204).json();
});

exports.deleteUser = asyncHandler(async (req, res) => {
	await User.findByIdAndDelete(req.params.id);
	await audit(req.user._id, 'DELETE_USER', 'User', req.params.id, {}, req.ip);
	res.status(200).json({ message: 'User deleted successfully.' });
});

// ── Dashboard ─────────────────────────────────────────────────────────────────

exports.mainDashboard = asyncHandler(async (req, res) => {
	const totalUsers = await User.countDocuments();
	const [totalTransaction] = await Transaction.aggregate([
		{ $match: { status: 'Success', type: 'transfer' } },
		{ $group: { _id: null, totalAmount: { $sum: '$amount' } } },
	]);
	const [totals] = await User.aggregate([
		{ $group: { _id: null, totalDeposit: { $sum: '$totaldeposit' }, totalWithdrawl: { $sum: '$totalwithdrawl' } } },
	]);

	const [americans, nigerians, others] = await Promise.all([
		User.countDocuments({ country: 'USA' }),
		User.countDocuments({ country: 'Nigeria' }),
		User.countDocuments({ country: { $nin: ['USA', 'Nigeria'] } }),
	]);

	res.status(200).json({
		totalUsers,
		totalTransaction: totalTransaction ? totalTransaction.totalAmount : 0,
		totalDeposit: totals ? totals.totalDeposit : 0,
		totalWithdrawl: totals ? totals.totalWithdrawl : 0,
		american: totalUsers ? ((americans / totalUsers) * 100).toFixed(2) : '0.00',
		nigerian: totalUsers ? ((nigerians / totalUsers) * 100).toFixed(2) : '0.00',
		other: totalUsers ? ((others / totalUsers) * 100).toFixed(2) : '0.00',
	});
});

// ── Rate management ───────────────────────────────────────────────────────────

exports.updateRate = asyncHandler(async (req, res) => {
	await Rate.updateMany({}, { amount: req.body.amount });
	await audit(req.user._id, 'UPDATE_RATE', 'Rate', null, { amount: req.body.amount }, req.ip);
	res.status(202).json({ message: 'Rate updated successfully.' });
});

exports.getRate = asyncHandler(async (req, res) => {
	const rate = await Rate.find({});
	res.status(200).json({ rate });
});

// ── KYC review ────────────────────────────────────────────────────────────────

exports.getPendingKyc = asyncHandler(async (req, res) => {
	const page = Math.max(1, parseInt(req.query.page) || 1);
	const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
	const skip = (page - 1) * limit;

	const [kycs, total] = await Promise.all([
		Kyc.find({ status: 'pending' })
			.populate('user', 'firstname lastname email country')
			.skip(skip)
			.limit(limit),
		Kyc.countDocuments({ status: 'pending' }),
	]);
	res.status(200).json({ kycs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

exports.reviewKyc = asyncHandler(async (req, res, next) => {
	const { status, rejectionReason } = req.body;
	if (!['approved', 'rejected'].includes(status)) {
		return res.status(400).json({ message: 'Status must be approved or rejected.' });
	}

	const kyc = await Kyc.findById(req.params.id);
	if (!kyc) return next(new ErrorHandler('KYC record not found', 404));

	await Kyc.findByIdAndUpdate(kyc._id, {
		status,
		rejectionReason: status === 'rejected' ? rejectionReason : undefined,
		reviewedBy: req.user._id,
		reviewedAt: new Date(),
	});
	await User.findByIdAndUpdate(kyc.user, { kycStatus: status });
	await audit(req.user._id, `KYC_${status.toUpperCase()}`, 'Kyc', kyc._id, { status, rejectionReason }, req.ip);

	res.status(200).json({ message: `KYC ${status}.` });
});

// ── Refund (proxied from paymentController) ───────────────────────────────────
// Admin calls this; the real logic lives in paymentController.refundTransaction
// but we add an audit log wrapper here via route middleware.

exports.auditRefund = asyncHandler(async (req, res, next) => {
	// Store original json method to intercept the response
	const originalJson = res.json.bind(res);
	res.json = async (body) => {
		if (res.statusCode < 400) {
			await audit(req.user._id, 'REFUND_TRANSACTION', 'Transaction', req.params.id, {}, req.ip);
		}
		originalJson(body);
	};
	next();
});

// ── Audit log ─────────────────────────────────────────────────────────────────

exports.getAuditLogs = asyncHandler(async (req, res) => {
	const page = Math.max(1, parseInt(req.query.page) || 1);
	const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
	const skip = (page - 1) * limit;

	const [logs, total] = await Promise.all([
		AuditLog.find({})
			.populate('admin', 'username')
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit),
		AuditLog.countDocuments(),
	]);

	res.status(200).json({ logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

// ── Flagged (AML) transactions ────────────────────────────────────────────────

exports.getFlaggedTransactions = asyncHandler(async (req, res) => {
	const page = Math.max(1, parseInt(req.query.page) || 1);
	const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
	const skip = (page - 1) * limit;

	const [transactions, total] = await Promise.all([
		Transaction.find({ flagged: true })
			.populate('sender', 'firstname lastname email')
			.populate('receiver', 'firstname lastname email')
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit),
		Transaction.countDocuments({ flagged: true }),
	]);

	res.status(200).json({ transactions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});
