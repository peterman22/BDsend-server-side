var express = require('express');
var router = express.Router();
var { body, param, query } = require('express-validator');

var authenticate = require('../middleware/auth');
var { validate } = require('../middleware/validate');
var { transferLimiter } = require('../middleware/rateLimiter');
var paymentController = require('../controllers/paymentController');

// ── Stripe webhook (raw body required — must be before express.json) ──────────
// Registered directly in index.js with express.raw(), not here

// ── History ───────────────────────────────────────────────────────────────────
router.get(
	'/transactionhistory',
	authenticate.verifyUser,
	[
		query('page').optional().isInt({ min: 1 }),
		query('limit').optional().isInt({ min: 1, max: 100 }),
	],
	validate,
	paymentController.transactionHistory
);
router.get(
	'/recenttransactionhistory',
	authenticate.verifyUser,
	paymentController.recentTransactionHistory
);

// ── Deposit ───────────────────────────────────────────────────────────────────
router.post(
	'/create-payment',
	authenticate.verifyUser,
	[body('amount').isInt({ min: 50 }).withMessage('Amount must be at least 50 cents (integer, in cents)')],
	validate,
	paymentController.createPayment
);

// ── Transfer ──────────────────────────────────────────────────────────────────
router.patch(
	'/transfer-money',
	authenticate.verifyUser,
	transferLimiter,
	[
		body('receivingId').isInt({ min: 100000000, max: 999999999 }),
		body('amount').isFloat({ min: 0.01 }),
		body('note').optional().trim().isLength({ max: 200 }),
	],
	validate,
	paymentController.checkBalance,
	paymentController.checkDailyLimit,
	paymentController.transferMoney
);

// ── Withdrawal ────────────────────────────────────────────────────────────────
router.patch(
	'/withdraw/money/:amount',
	authenticate.verifyUser,
	[param('amount').isFloat({ min: 0.01 })],
	validate,
	paymentController.withdrawlMoney
);

// ── Refund (admin-only, mounted under /payment but guarded in adminRoutes too) ─
router.post(
	'/refund/:id',
	authenticate.verifyUser,
	paymentController.refundTransaction
);

module.exports = router;
