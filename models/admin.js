var mongoose = require('mongoose');
var passportLocalMongoose = require('passport-local-mongoose');
var Schema = mongoose.Schema;

var schema = new Schema({
	username: { type: String, required: true, unique: true },
});

schema.plugin(passportLocalMongoose);

const Admin = mongoose.model('Admin', schema);
module.exports = Admin;
