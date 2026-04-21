var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var KycSchema = new Schema(
	{
		user: { type: mongoose.Types.ObjectId, ref: 'User', required: true, unique: true },
		idType: {
			type: String,
			enum: ['passport', 'national_id', 'drivers_license'],
			required: true,
		},
		idNumber: { type: String, required: true },
		idFront: { type: String },
		idBack: { type: String },
		selfie: { type: String },
		status: {
			type: String,
			enum: ['pending', 'approved', 'rejected'],
			default: 'pending',
		},
		rejectionReason: { type: String },
		reviewedBy: { type: mongoose.Types.ObjectId, ref: 'Admin' },
		reviewedAt: { type: Date },
	},
	{ timestamps: true }
);

module.exports = mongoose.model('Kyc', KycSchema);
