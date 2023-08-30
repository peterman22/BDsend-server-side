var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Rate = new Schema(
	{
		amount: { type: Number, required: true, default: 900 },
	},
	{ timestamps: true }
);

module.exports = mongoose.model('Rate', Rate);
