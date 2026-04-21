var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Transaction = new Schema(
	{
		sender: { type: mongoose.Types.ObjectId, ref: 'User' },
		receiver: { type: mongoose.Types.ObjectId, ref: 'User' },
		status: {
			type: String,
			required: true,
			enum: ['Success', 'Canceled', 'Pending', 'Refunded'],
		},
		amount: { type: Number, required: true },
		currency: { type: String, default: 'USD' },
		type: {
			type: String,
			enum: ['transfer', 'deposit', 'withdrawal', 'refund'],
			default: 'transfer',
		},
		note: { type: String, default: '' },
		idempotencyKey: { type: String, sparse: true, unique: true },
		// AML
		flagged: { type: Boolean, default: false },
		flagReasons: [{ type: String }],
		// Refund linkage
		refundOf: { type: mongoose.Types.ObjectId, ref: 'Transaction' },
	},
	{ timestamps: true }
);

module.exports = mongoose.model('Transaction', Transaction);
