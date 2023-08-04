// const express = require('express');
// const router = express.Router();

// const {
// 	estimateBTCTransactionFee,
// 	btcCheckBalanceMiddleWare,
// 	validateBitcoinAddress,
// 	createAndBroadcastBTCTransaction,
// } = require('../controllers/bitcoinController');
// const authenticate = require('../middleware/auth');

// //? Bitcoin Routes //

// router.post(
// 	'/estimate_fee_btc_transaction',
// 	authenticate.verifyUser,
// 	validateBitcoinAddress,
// 	btcCheckBalanceMiddleWare,
// 	estimateBTCTransactionFee
// );
// router.post(
// 	'/send_btc_to_wallet',
// 	authenticate.verifyUser,
// 	validateBitcoinAddress,
// 	btcCheckBalanceMiddleWare,
// 	createAndBroadcastBTCTransaction
// );

// module.exports = router;
