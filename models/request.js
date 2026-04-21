var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Request = new Schema(
	{
		requested_by: { type: mongoose.Types.ObjectId, ref: 'User' },
		requested_from: { type: mongoose.Types.ObjectId, ref: 'User' },
		status: {
			type: String,
			required: true,
			enum: ['pending', 'accepted', 'rejected'],
			default: 'pending',
		},
		amount: { type: Number, required: true },
		note: { type: String, default: '' },
	},
	{ timestamps: true }
);

module.exports = mongoose.model('Request', Request);
