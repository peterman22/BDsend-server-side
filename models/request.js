var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Request = new Schema(
	{
		requested_by: { type: mongoose.Types.ObjectId, ref: 'User' },
		requested_from: {
			type: mongoose.Types.ObjectId,
			ref: 'User',
		},
		status: {
			type: String,
			required: true,
		},
		amount: { type: Number, required: true },
	},
	{ timestamps: true }
);

module.exports = mongoose.model('Request', Request);
