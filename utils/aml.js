var Transaction = require('../models/transaction');

const LARGE_TRANSACTION_THRESHOLD = 10000;
const RAPID_TRANSFER_COUNT = 5;
const RAPID_TRANSFER_WINDOW_MS = 10 * 60 * 1000;

exports.checkAmlFlags = async (userId, amount) => {
	const flags = [];

	if (amount >= LARGE_TRANSACTION_THRESHOLD) {
		flags.push('large_transaction');
	}

	const windowStart = new Date(Date.now() - RAPID_TRANSFER_WINDOW_MS);
	const recentCount = await Transaction.countDocuments({
		sender: userId,
		createdAt: { $gte: windowStart },
		status: 'Success',
	});

	if (recentCount >= RAPID_TRANSFER_COUNT) {
		flags.push('rapid_transfers');
	}

	return flags;
};
