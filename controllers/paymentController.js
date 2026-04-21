var asyncHandler = require('../middleware/asyncHandler');
var ErrorHandler = require('../utils/error');
var notifications = require('../utils/notifications');
var aml = require('../utils/aml');

var stripe = require('stripe')(process.env.SECRET_KEY);

var User = require('../models/users');
var Transaction = require('../models/transaction');
var Idempotency = require('../models/idempotency');

// ── Stripe deposit ────────────────────────────────────────────────────────────

exports.createPayment = asyncHandler(async (req, res) => {
	const amount = Number(req.body.amount);
	const idempotencyKey = req.headers['idempotency-key'];

	// Return cached response for duplicate requests
	if (idempotencyKey) {
		const cached = await Idempotency.findOne({
			key: `payment:${idempotencyKey}`,
			user: req.user._id,
		});
		if (cached) return res.status(200).json(cached.response);
	}

	const paymentIntent = await stripe.paymentIntents.create({
		amount,
		currency: req.user.currency.toLowerCase(),
		automatic_payment_methods: { enabled: true },
	});

	const response = { clientSecret: paymentIntent.client_secret };

	if (idempotencyKey) {
		await Idempotency.create({
			key: `payment:${idempotencyKey}`,
			user: req.user._id,
			response,
		});
	}

	res.json(response);
});

// Stripe webhook: called by Stripe when a payment_intent is confirmed
exports.stripeWebhook = async (req, res) => {
	const sig = req.headers['stripe-signature'];
	let event;
	try {
		event = stripe.webhooks.constructEvent(
			req.body,
			sig,
			process.env.STRIPE_WEBHOOK_SECRET
		);
	} catch (err) {
		return res.status(400).json({ message: `Webhook signature invalid: ${err.message}` });
	}

	if (event.type === 'payment_intent.succeeded') {
		const intent = event.data.object;
		// intent.metadata.userId must be set when creating the PaymentIntent
		const userId = intent.metadata && intent.metadata.userId;
		if (userId) {
			const amountDollars = intent.amount_received / 100;
			await User.findByIdAndUpdate(userId, {
				$inc: { wallet: amountDollars, totaldeposit: amountDollars },
			});
			await Transaction.create({
				receiver: userId,
				amount: amountDollars,
				currency: intent.currency.toUpperCase(),
				status: 'Success',
				type: 'deposit',
			});
			const user = await User.findById(userId);
			if (user) {
				notifications.sendDepositConfirmed(user.email, amountDollars, intent.currency.toUpperCase());
			}
		}
	}

	res.status(200).json({ received: true });
};

// ── Balance check middleware ───────────────────────────────────────────────────

exports.checkBalance = asyncHandler(async (req, res, next) => {
	const amount = Number(req.body.amount);
	if (req.user.wallet < amount) {
		const receiver = await User.findOne({ receivingId: req.body.receivingId });
		await Transaction.create({
			sender: req.user._id,
			receiver: receiver ? receiver._id : null,
			amount,
			currency: req.user.currency,
			status: 'Canceled',
			type: 'transfer',
		});
		return res.status(400).json({ message: 'Insufficient balance.' });
	}
	next();
});

// ── Daily limit middleware ─────────────────────────────────────────────────────

exports.checkDailyLimit = asyncHandler(async (req, res, next) => {
	const amount = Number(req.body.amount);
	const user = await User.findById(req.user._id);

	// Reset counter if we've passed the reset time
	if (user.dailyTransferResetAt <= new Date()) {
		const nextReset = new Date();
		nextReset.setUTCHours(24, 0, 0, 0);
		await User.findByIdAndUpdate(user._id, {
			dailyTransferUsed: 0,
			dailyTransferResetAt: nextReset,
		});
		user.dailyTransferUsed = 0;
	}

	if (user.dailyTransferUsed + amount > user.dailyTransferLimit) {
		return res.status(400).json({
			message: `Daily transfer limit of ${user.dailyTransferLimit} ${user.currency} exceeded.`,
		});
	}
	next();
});

// ── P2P Transfer ──────────────────────────────────────────────────────────────

exports.transferMoney = asyncHandler(async (req, res) => {
	const amount = Number(req.body.amount);
	const idempotencyKey = req.headers['idempotency-key'];

	// Idempotency guard
	if (idempotencyKey) {
		const cached = await Idempotency.findOne({
			key: `transfer:${idempotencyKey}`,
			user: req.user._id,
		});
		if (cached) return res.status(200).json(cached.response);
	}

	const receiver = await User.findOne({ receivingId: req.body.receivingId });
	if (!receiver) {
		return res.status(400).json({ message: 'Invalid receiving ID.' });
	}
	if (receiver._id.equals(req.user._id)) {
		return res.status(400).json({ message: 'Cannot transfer money to yourself.' });
	}

	// AML check
	const flagReasons = await aml.checkAmlFlags(req.user._id, amount);

	await User.findByIdAndUpdate(receiver._id, { $inc: { wallet: amount } });
	await User.findByIdAndUpdate(req.user._id, {
		$inc: { wallet: -amount, dailyTransferUsed: amount },
	});

	const txn = await Transaction.create({
		sender: req.user._id,
		receiver: receiver._id,
		amount,
		currency: req.user.currency,
		status: 'Success',
		type: 'transfer',
		note: req.body.note || '',
		flagged: flagReasons.length > 0,
		flagReasons,
		idempotencyKey: idempotencyKey
			? `transfer:${idempotencyKey}`
			: undefined,
	});

	const response = { message: 'Money transferred successfully.', transactionId: txn._id };

	if (idempotencyKey) {
		await Idempotency.create({
			key: `transfer:${idempotencyKey}`,
			user: req.user._id,
			response,
		});
	}

	// Notify receiver
	notifications.sendMoneyReceived(
		receiver.email,
		`${req.user.firstname} ${req.user.lastname}`,
		amount,
		req.user.currency
	);

	res.status(200).json(response);
});

// ── Transaction history (paginated) ──────────────────────────────────────────

exports.transactionHistory = asyncHandler(async (req, res) => {
	const page = Math.max(1, parseInt(req.query.page) || 1);
	const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
	const skip = (page - 1) * limit;

	const query = { $or: [{ sender: req.user._id }, { receiver: req.user._id }] };

	const [history, total] = await Promise.all([
		Transaction.find(query)
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit)
			.populate('sender', 'firstname lastname email receivingId')
			.populate('receiver', 'firstname lastname email receivingId'),
		Transaction.countDocuments(query),
	]);

	res.status(200).json({
		history,
		pagination: { page, limit, total, pages: Math.ceil(total / limit) },
	});
});

exports.recentTransactionHistory = asyncHandler(async (req, res) => {
	const history = await Transaction.find({
		$or: [{ sender: req.user._id }, { receiver: req.user._id }],
	})
		.sort({ createdAt: -1 })
		.limit(4)
		.populate('sender', 'firstname lastname email receivingId')
		.populate('receiver', 'firstname lastname email receivingId');
	res.status(200).json({ history });
});

// ── Withdrawal ────────────────────────────────────────────────────────────────

exports.withdrawlMoney = asyncHandler(async (req, res) => {
	const amount = JSON.parse(req.params.amount);
	if (req.user.wallet < amount) {
		return res.status(400).json({ message: 'Insufficient balance.' });
	}
	await User.findByIdAndUpdate(req.user._id, {
		$inc: { wallet: -amount, totalwithdrawl: amount },
	});
	await Transaction.create({
		sender: req.user._id,
		amount,
		currency: req.user.currency,
		status: 'Success',
		type: 'withdrawal',
	});
	res.status(204).json();
});

// ── Refund (admin-initiated) ──────────────────────────────────────────────────

exports.refundTransaction = asyncHandler(async (req, res, next) => {
	const txn = await Transaction.findById(req.params.id)
		.populate('sender')
		.populate('receiver');

	if (!txn) return next(new ErrorHandler('Transaction not found', 404));
	if (txn.status !== 'Success' || txn.type !== 'transfer') {
		return res.status(400).json({ message: 'Only successful transfers can be refunded.' });
	}
	if (txn.refundOf) {
		return res.status(400).json({ message: 'Transaction already refunded.' });
	}

	// Reverse the funds
	await User.findByIdAndUpdate(txn.receiver._id, { $inc: { wallet: -txn.amount } });
	await User.findByIdAndUpdate(txn.sender._id, { $inc: { wallet: txn.amount } });

	// Mark original as refunded
	await Transaction.findByIdAndUpdate(txn._id, { status: 'Refunded' });

	// Create refund record
	await Transaction.create({
		sender: txn.receiver._id,
		receiver: txn.sender._id,
		amount: txn.amount,
		currency: txn.currency,
		status: 'Success',
		type: 'refund',
		refundOf: txn._id,
	});

	// Notify original sender they got their money back
	if (txn.sender) {
		notifications.sendRefundNotification(txn.sender.email, txn.amount, txn.currency);
	}

	res.status(200).json({ message: 'Transaction refunded successfully.' });
});
