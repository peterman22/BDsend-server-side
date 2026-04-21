var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var RefreshTokenSchema = new Schema(
	{
		user: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
		token: { type: String, required: true, unique: true },
		expiresAt: { type: Date, required: true },
		revoked: { type: Boolean, default: false },
	},
	{ timestamps: true }
);

// Auto-delete expired tokens via MongoDB TTL
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshToken', RefreshTokenSchema);
