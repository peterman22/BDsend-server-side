const bitcoin = require('bitcoinjs-lib');
const { ECPairFactory } = require('ecpair');
const ecc = require('tiny-secp256k1');
const ECPair = ECPairFactory(ecc);
const axios = require('axios');

const satoshi = 100000000;

exports.validateBitcoinAddress = async (req, res, next) => {
	const { toAddress } = req.body;
	if (toAddress) {
		axios
			.get(
				`${process.env.BLOCKCYPHER_URL}addrs/${toAddress}/balance?token=${process.env.BLOCKCYPHER_TOKEN}`
			)
			.then(response => {
				return next();
			})
			.catch(err => {
				return res.status(400).json({ error: err.response.data.error });
			});
	} else {
		return res.status(400).json({ error: 'All fields are required' });
	}
};

exports.btcCheckBalanceMiddleWare = async (req, res, next) => {
	const { fromAddress, amount } = req.body;
	if (fromAddress && amount) {
		try {
			const checkBal = await axios.get(
				`${process.env.BLOCKCYPHER_URL}addrs/${fromAddress}/balance?token=${process.env.BLOCKCYPHER_TOKEN}`
			);
			const balData = checkBal.data;
			const balance = balData.final_balance;
			const balInBTC = balance / satoshi;
			console.log(
				'🚀 ~ file: bitcoin.controller.js ~ line 151 ~ exports.btcTransactionMiddleWare= ~ balInBTC',
				balInBTC
			);

			if (balInBTC < Number(amount)) {
				return res.status(400).json({
					error: `You do not have enough BTC. Kindly get more BTC to proceed.`,
				});
			} else {
				return next();
			}
		} catch (error) {
			console.log(
				'🚀 ~ file: bitcoin.controller.js ~ line 157 ~ exports.btcTransactionMiddleWare= ~ error',
				error
			);
			return res.status(400).json({ error: error.message });
		}
	} else {
		return res.status(400).json({ error: 'All fields are required' });
	}
};

exports.estimateBTCTransactionFee = async (req, res) => {
	const { fromAddress, toAddress, amount } = req.body;

	if (fromAddress && toAddress && amount) {
		estimateFeeForBTCTransaction(fromAddress, toAddress, amount, res);
	} else {
		return res.status(400).json({ error: 'All fields are required' });
	}
};

exports.createAndBroadcastBTCTransaction = async (req, res) => {
	const { fromAddress, toAddress, privateKey, amount } = req.body;
	if (fromAddress && toAddress && amount) {
		sendBtcTransaction(fromAddress, toAddress, amount, privateKey, res);
	} else {
		return res.status(400).json({ error: 'All fields are required' });
	}
};

const estimateFeeForBTCTransaction = async (
	fromAddress,
	toAddress,
	amount,
	res
) => {
	const amountIn = Number(amount) * satoshi;
	var newtx = {
		inputs: [{ addresses: [fromAddress] }],
		outputs: [{ addresses: [toAddress], value: amountIn }],
	};
	try {
		const transactionDetail = await axios.post(
			`${process.env.BLOCKCYPHER_URL}txs/new?token=${process.env.BLOCKCYPHER_TOKEN}`,
			JSON.stringify(newtx)
		);
		const transactionData = transactionDetail.data;
		const feeInSatoshi = transactionData.tx.fees;
		const balInBTC = feeInSatoshi / satoshi;
		return res.status(200).json({ estimatedGasFee: balInBTC });
	} catch (error) {
		console.log(
			'🚀 ~ file: bitcoin.controller.js:117 ~ estimateFeeForBTCTransaction ~ error:',
			error
		);
		return res.status(400).json({ error: error.message });
	}
};

const sendBtcTransaction = async (
	fromAddress,
	toAddress,
	amount,
	privateKey,
	res
) => {
	try {
		const keyPair = await ECPair.fromPrivateKey(
			Buffer.from(privateKey, 'hex')
		);

		const amountIn = amount * satoshi;
		var newtx = {
			inputs: [{ addresses: [fromAddress] }],
			outputs: [{ addresses: [toAddress], value: amountIn }],
		};

		const transactionDetail = await axios.post(
			`${process.env.BLOCKCYPHER_URL}txs/new?token=${process.env.BLOCKCYPHER_TOKEN}`,
			JSON.stringify(newtx)
		);
		const tmptx = transactionDetail.data;
		tmptx.pubkeys = [];
		tmptx.signatures = tmptx.tosign.map(function (tosign, n) {
			tmptx.pubkeys.push(keyPair.publicKey.toString('hex'));
			return bitcoin.script.signature
				.encode(keyPair.sign(Buffer.from(tosign, 'hex')), 0x01)
				.toString('hex')
				.slice(0, -2);
		});

		const finalTransaction = await axios.post(
			`${process.env.BLOCKCYPHER_URL}txs/send?token=${process.env.BLOCKCYPHER_TOKEN}`,
			JSON.stringify(tmptx)
		);

		const transactionData = finalTransaction.data;
		const TransactionHash = transactionData.tx.hash;

		return res.status(200).json({ transactionHash: TransactionHash });
	} catch (error) {
		console.log(
			'🚀 ~ file: bitcoin.controller.js ~ line 111 ~ exports.createBTCTransaction= ~ error',
			error
		);
		return res.status(400).json({ error: error.message });
	}
};
