var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var AuditLogSchema = new Schema(
	{
		admin: { type: mongoose.Types.ObjectId, ref: 'Admin', required: true },
		action: { type: String, required: true },
		targetType: { type: String },
		targetId: { type: mongoose.Types.ObjectId },
		details: { type: mongoose.Schema.Types.Mixed },
		ip: { type: String },
	},
	{ timestamps: true }
);

module.exports = mongoose.model('AuditLog', AuditLogSchema);
