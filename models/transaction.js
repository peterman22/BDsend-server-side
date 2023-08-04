var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Transaction = new Schema(
	{
		sender: { type: mongoose.Types.ObjectId, ref: 'User' },
		receiver: {
			type: mongoose.Types.ObjectId,
			ref: 'User',
		},
		status: {
			type: String,
			required: true,
			enum: ['Success', 'Canceled', 'Pending'],
		},
		amount: { type: Number, required: true },
	},
	{ timestamps: true }
);

module.exports = mongoose.model('Transaction', Transaction);
