var express = require('express');
var router = express.Router();
var passport = require('passport');
var { body, query } = require('express-validator');

var authenticate = require('../middleware/authAdmin');
var { validate } = require('../middleware/validate');
var { loginLimiter } = require('../middleware/rateLimiter');
var adminController = require('../controllers/adminController');
var paymentController = require('../controllers/paymentController');

// ── Auth ──────────────────────────────────────────────────────────────────────
router.post(
	'/register',
	[
		body('username').trim().notEmpty(),
		body('password').isLength({ min: 8 }),
	],
	validate,
	adminController.register
);
router.post(
	'/signin',
	loginLimiter,
	passport.authenticate('local-admin'),
	adminController.signIn
);

// ── Profile ───────────────────────────────────────────────────────────────────
router.get('/info', authenticate.verifyAdmin, adminController.getUser);
router.patch(
	'/profile/change',
	authenticate.verifyAdmin,
	[body('username').trim().notEmpty(), body('password').isLength({ min: 8 })],
	validate,
	adminController.editAdmin
);

// ── Dashboard ─────────────────────────────────────────────────────────────────
router.get('/main', authenticate.verifyAdmin, adminController.mainDashboard);

// ── User management ───────────────────────────────────────────────────────────
router.get(
	'/users/list',
	authenticate.verifyAdmin,
	[
		query('page').optional().isInt({ min: 1 }),
		query('limit').optional().isInt({ min: 1, max: 100 }),
	],
	validate,
	adminController.getUsers
);
router.patch(
	'/profile/edit/user/:id',
	authenticate.verifyAdmin,
	adminController.editUser
);
router.patch(
	'/profile/active/:id',
	authenticate.verifyAdmin,
	adminController.editActiveUser
);
router.delete(
	'/profile/user/delete/:id',
	authenticate.verifyAdmin,
	adminController.deleteUser
);

// ── Rate ──────────────────────────────────────────────────────────────────────
router.get('/rate/get', authenticate.verifyAdmin, adminController.getRate);
router.patch(
	'/rate/update',
	authenticate.verifyAdmin,
	[body('amount').isFloat({ min: 0 })],
	validate,
	adminController.updateRate
);

// ── KYC ───────────────────────────────────────────────────────────────────────
router.get('/kyc/pending', authenticate.verifyAdmin, adminController.getPendingKyc);
router.patch(
	'/kyc/review/:id',
	authenticate.verifyAdmin,
	[
		body('status').isIn(['approved', 'rejected']),
		body('rejectionReason').if(body('status').equals('rejected')).notEmpty(),
	],
	validate,
	adminController.reviewKyc
);

// ── Refund ────────────────────────────────────────────────────────────────────
router.post(
	'/refund/:id',
	authenticate.verifyAdmin,
	adminController.auditRefund,
	paymentController.refundTransaction
);

// ── Audit logs ────────────────────────────────────────────────────────────────
router.get(
	'/audit-logs',
	authenticate.verifyAdmin,
	[
		query('page').optional().isInt({ min: 1 }),
		query('limit').optional().isInt({ min: 1, max: 100 }),
	],
	validate,
	adminController.getAuditLogs
);

// ── AML flagged transactions ──────────────────────────────────────────────────
router.get(
	'/flagged-transactions',
	authenticate.verifyAdmin,
	adminController.getFlaggedTransactions
);

module.exports = router;
