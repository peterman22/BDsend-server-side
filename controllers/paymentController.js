var asyncHandler = require('../middleware/asyncHandler');
var stripe = require('stripe')(process.env.SECRET_KEY);

var User = require('../models/users');
var Transaction = require('../models/transaction');

exports.createPayment = asyncHandler(async (req, res, next) => {
	const paymentIntent = await stripe.paymentIntents.create({
		amount: req.body.amount,
		currency: 'usd',
		automatic_payment_methods: {
			enabled: true,
		},
	});
	res.json({
		clientSecret: paymentIntent.client_secret,
	});
});

exports.checkBalance = asyncHandler(async (req, res, next) => {
	if (req.user.wallet < req.body.amount) {
		const receiver = await User.findOne({
			receivingId: req.body.receivingId,
		});
		await Transaction.create({
			sender: req.user._id,
			receiver: receiver._id,
			amount: req.body.amount,
			status: 'Canceled',
		});
		return res.status(400).json({ message: 'Not Enough balance.' });
	}
	next();
});

exports.transferMoney = asyncHandler(async (req, res, next) => {
	const receiver = await User.findOne({ receivingId: req.body.receivingId });
	if (receiver) {
		await User.findByIdAndUpdate(receiver._id, {
			$inc: { wallet: req.body.amount },
		});
		await User.findByIdAndUpdate(req.user._id, {
			$inc: { wallet: -req.body.amount },
		});
		await Transaction.create({
			sender: req.user._id,
			receiver: receiver._id,
			amount: req.body.amount,
			status: 'Success',
		});
		return res.status(204).json({ message: 'Money transferred.' });
	} else {
		return res.status(400).json({ messsage: 'Invalid Receiving Id.' });
	}
});

exports.transactionHistory = asyncHandler(async (req, res, next) => {
	const history = await Transaction.find({
		$or: [{ sender: req.user._id }, { receiver: req.user._id }],
	})
		.populate('sender')
		.populate('receiver');
	res.status(200).json({ history });
});

exports.recentTransactionHistory = asyncHandler(async (req, res, next) => {
	const history = await Transaction.find({
		$or: [{ sender: req.user._id }, { receiver: req.user._id }],
	})
		.sort({ createdAt: -1 })
		.limit(4)
		.populate('sender')
		.populate('receiver');
	res.status(200).json({ history });
});

exports.withdrawlMoney = asyncHandler(async (req, res, next) => {
	let update = {
		wallet: req.user.wallet - JSON.parse(req.params.amount),
		totalwithdrawl: req.user.totalwithdrawl + JSON.parse(req.params.amount),
	};
	await User.findByIdAndUpdate(req.user._id, update);
	res.status(204).json();
});
