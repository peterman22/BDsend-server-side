var nodemailer = require('nodemailer');

function getTransport() {
	return nodemailer.createTransport({
		host: 'smtp.gmail.com',
		port: 465,
		secure: true,
		auth: {
			user: process.env.EMAIL,
			pass: process.env.EMAIL_PASSWORD,
		},
	});
}

async function send(to, subject, text) {
	try {
		const transport = getTransport();
		await transport.sendMail({ from: process.env.EMAIL, to, subject, text });
	} catch (err) {
		// Notifications are non-critical; log and continue
		console.error('Notification email failed:', err.message);
	}
}

exports.sendMoneyReceived = (toEmail, senderName, amount, currency = 'USD') =>
	send(
		toEmail,
		'You received money on BDsend',
		`${senderName} sent you ${currency} ${amount.toFixed(2)}. Your wallet has been credited.`
	);

exports.sendMoneyRequest = (toEmail, requesterName, amount, currency = 'USD') =>
	send(
		toEmail,
		'New money request on BDsend',
		`${requesterName} has requested ${currency} ${amount.toFixed(2)} from you on BDsend.`
	);

exports.sendRequestAccepted = (toEmail, amount, currency = 'USD') =>
	send(
		toEmail,
		'Your money request was accepted',
		`Your request for ${currency} ${amount.toFixed(2)} has been accepted and the funds are now in your wallet.`
	);

exports.sendRequestRejected = (toEmail, amount, currency = 'USD') =>
	send(
		toEmail,
		'Your money request was declined',
		`Your request for ${currency} ${amount.toFixed(2)} was declined.`
	);

exports.sendRefundNotification = (toEmail, amount, currency = 'USD') =>
	send(
		toEmail,
		'Refund processed on BDsend',
		`A refund of ${currency} ${amount.toFixed(2)} has been credited to your wallet.`
	);

exports.sendDepositConfirmed = (toEmail, amount, currency = 'USD') =>
	send(
		toEmail,
		'Deposit confirmed on BDsend',
		`Your deposit of ${currency} ${amount.toFixed(2)} has been confirmed and added to your wallet.`
	);
