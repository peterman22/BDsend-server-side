var express = require('express');
var router = express.Router();
var authenticate = require('../middleware/auth');
var paymentController = require('../controllers/paymentController');

// ? Payment Routes //
router.get(
	'/transactionhistory',
	authenticate.verifyUser,
	paymentController.transactionHistory
);
router.get(
	'/recenttransactionhistory',
	authenticate.verifyUser,
	paymentController.recentTransactionHistory
);
router.post(
	'/create-payment',
	authenticate.verifyUser,
	paymentController.createPayment
);
router.patch(
	'/transfer-money',
	authenticate.verifyUser,
	paymentController.checkBalance,
	paymentController.transferMoney
);
router.patch(
	'/withdraw/money/:amount',
	authenticate.verifyUser,
	paymentController.withdrawlMoney
);

module.exports = router;
