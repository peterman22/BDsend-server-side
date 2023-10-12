var express = require('express');
var router = express.Router();
var passport = require('passport');
var authenticate = require('../middleware/auth');
var userController = require('../controllers/userController');

// ? User Routes //
router.get('/getotp/:email', userController.getOtp);
router.get('/verifyotp/:email/:otp', userController.verifyOtp);
router.get('/user', authenticate.verifyUser, userController.getUser);
router.get(
	'/verify-pin/:pin',
	authenticate.verifyUser,
	userController.verifyPin
);
router.post('/register', userController.register);
router.post('/signin', passport.authenticate('local'), userController.signIn);
router.patch('/reset-password', userController.passwordReset);
router.patch('/setpin/:email', userController.addPin);
router.patch('/edituser', authenticate.verifyUser, userController.editUser);
router.patch('/changepin', authenticate.verifyUser, userController.changePin);
router.patch(
	'/change-password',
	passport.authenticate('local'),
	userController.passwordChange
);
router.patch(
	'/change-password',
	passport.authenticate('local'),
	userController.passwordChange
);
router.patch(
	'/update-wallet/:amount',
	authenticate.verifyUser,
	userController.updateWallet
);
router.patch(
	'/update-wallet/deduct/:amount',
	authenticate.verifyUser,
	userController.updateWallet
);

//TODO: requests
router.get(
	'/requests/created',
	authenticate.verifyUser,
	userController.getRequestsCreated
);
router.get('/requests', authenticate.verifyUser, userController.getRequests);
router.post(
	'/request/create',
	authenticate.verifyUser,
	userController.createRequest
);
router.patch(
	'/request/reject/:id',
	authenticate.verifyUser,
	userController.rejectRequest
);
router.patch(
	'/request/accept/:id',
	authenticate.verifyUser,
	userController.acceptRequest
);

module.exports = router;
