var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var IdempotencySchema = new Schema(
	{
		key: { type: String, required: true, unique: true },
		user: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
		response: { type: mongoose.Schema.Types.Mixed },
	},
	{ timestamps: true }
);

// Keys expire after 24 hours
IdempotencySchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('Idempotency', IdempotencySchema);
