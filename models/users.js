var mongoose = require('mongoose');
var passportLocalMongoose = require('passport-local-mongoose');
var Schema = mongoose.Schema;

var userSchema = new Schema({
	email: { type: String, default: '' },
	phonenumber: {
		type: String,
		default: '',
	},
	pin: {
		type: String,
		default: '',
	},
	fullname: { type: String },
	picture: { type: String, default: '' },
	dob: { type: String, default: '' },
	country: { type: String, default: '' },
	address: { type: String, default: '' },
	receivingId: {
		type: Number,
		unqiue: true,
	},
	wallet: { type: Number, default: 0 },
	active: { type: Boolean, default: true },
	totaldeposit: { type: Number, default: 0 },
});

userSchema.pre('save', async function (next) {
	if (!this.receivingId) {
		this.receivingId = await generateUniqueNumbers(User);
	}
	next();
});
userSchema.plugin(passportLocalMongoose, {
	usernameField: 'email',
});

const generateUniqueNumbers = async model => {
	while (true) {
		const candidateNumber = Math.floor(
			100000000 + Math.random() * 900000000
		);
		const existingDocument = await model.findOne({
			receivingId: candidateNumber,
		});
		if (!existingDocument) {
			return candidateNumber;
		}
	}
};

const User = mongoose.model('User', userSchema);
module.exports = User;
