var express = require('express');
var router = express.Router();
var passport = require('passport');
var { body, param } = require('express-validator');

var authenticate = require('../middleware/auth');
var { validate } = require('../middleware/validate');
var { loginLimiter, otpLimiter } = require('../middleware/rateLimiter');
var userController = require('../controllers/userController');

// ── OTP ───────────────────────────────────────────────────────────────────────
router.get(
	'/getotp/:email',
	otpLimiter,
	[param('email').isEmail().normalizeEmail()],
	validate,
	userController.getOtp
);
router.get(
	'/resendotp/:email',
	otpLimiter,
	[param('email').isEmail().normalizeEmail()],
	validate,
	userController.getOtp
);
router.get(
	'/verifyotp/:email/:otp',
	[param('email').isEmail().normalizeEmail(), param('otp').isLength({ min: 4, max: 4 }).isNumeric()],
	validate,
	userController.verifyOtp
);

// ── Auth ──────────────────────────────────────────────────────────────────────
router.post(
	'/register',
	[
		body('email').isEmail().normalizeEmail(),
		body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
		body('firstname').trim().notEmpty().withMessage('First name is required'),
		body('lastname').trim().notEmpty().withMessage('Last name is required'),
		body('phonenumber').trim().notEmpty().withMessage('Phone number is required'),
		body('country').trim().notEmpty().withMessage('Country is required'),
	],
	validate,
	userController.register
);
router.post(
	'/signin',
	loginLimiter,
	[
		body('email').isEmail().normalizeEmail(),
		body('password').notEmpty(),
		body('pin').isLength({ min: 4, max: 4 }).isNumeric().withMessage('PIN must be 4 digits'),
	],
	validate,
	passport.authenticate('local'),
	userController.signIn
);
router.post('/signout', userController.signOut);
router.post(
	'/token/refresh',
	[body('refreshToken').notEmpty()],
	validate,
	userController.refreshToken
);

// ── Profile ───────────────────────────────────────────────────────────────────
router.get('/user', authenticate.verifyUser, userController.getUser);
router.get('/verify-pin/:pin', authenticate.verifyUser, userController.verifyPin);

router.patch(
	'/reset-password',
	[
		body('email').isEmail().normalizeEmail(),
		body('password').isLength({ min: 8 }),
	],
	validate,
	userController.passwordReset
);
router.patch(
	'/setpin/:email',
	[
		param('email').isEmail().normalizeEmail(),
		body('pin').isLength({ min: 4, max: 4 }).isNumeric(),
	],
	validate,
	userController.addPin
);
router.patch(
	'/edituser',
	authenticate.verifyUser,
	[
		body('email').optional().isEmail().normalizeEmail(),
		body('firstname').optional().trim().notEmpty(),
		body('lastname').optional().trim().notEmpty(),
	],
	validate,
	userController.editUser
);
router.patch(
	'/changepin',
	authenticate.verifyUser,
	[
		body('oldpin').isLength({ min: 4, max: 4 }).isNumeric(),
		body('newpin').isLength({ min: 4, max: 4 }).isNumeric(),
	],
	validate,
	userController.changePin
);
router.patch(
	'/change-password',
	passport.authenticate('local'),
	[body('new_password').isLength({ min: 8 })],
	validate,
	userController.passwordChange
);
router.patch(
	'/update-wallet/:amount',
	authenticate.verifyUser,
	[param('amount').isFloat({ min: 0.01 })],
	validate,
	userController.updateWallet
);
router.patch(
	'/update-wallet/deduct/:amount',
	authenticate.verifyUser,
	[param('amount').isFloat({ min: 0.01 })],
	validate,
	userController.updateWalletDeduct
);

// ── KYC ───────────────────────────────────────────────────────────────────────
router.post(
	'/kyc/submit',
	authenticate.verifyUser,
	[
		body('idType').isIn(['passport', 'national_id', 'drivers_license']),
		body('idNumber').trim().notEmpty(),
	],
	validate,
	userController.submitKyc
);
router.get('/kyc/status', authenticate.verifyUser, userController.getKycStatus);

// ── Money Requests ────────────────────────────────────────────────────────────
router.get('/requests/created', authenticate.verifyUser, userController.getRequestsCreated);
router.get('/requests', authenticate.verifyUser, userController.getRequests);
router.post(
	'/request/create',
	authenticate.verifyUser,
	[
		body('receiving_id').isInt({ min: 100000000, max: 999999999 }),
		body('amount').isFloat({ min: 0.01 }),
	],
	validate,
	userController.createRequest
);
router.patch('/request/reject/:id', authenticate.verifyUser, userController.rejectRequest);
router.patch('/request/accept/:id', authenticate.verifyUser, userController.acceptRequest);

module.exports = router;
