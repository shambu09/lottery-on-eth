const assert = require("assert");
const { AssertionError } = require("assert");
const { lookup } = require("dns");
const ganache = require("ganache-cli");
const Web3 = require("web3");
const web3 = new Web3(ganache.provider());
const { interface, bytecode } = require("../compile");

let lottery;
let accounts;

beforeEach(async () => {
	//Get the list of all acoounts.
	accounts = await web3.eth.getAccounts();
	//Deploy using any of those accounts.

	lottery = await new web3.eth.Contract(JSON.parse(interface))
		.deploy({ data: bytecode })
		.send({
			from: accounts[0],
			gas: "1000000",
		});
});

describe("Lottery Contract", () => {
	it("deploys a contract", () => {
		assert.ok(lottery.options.address);
	});

	it("allows one account to enter", async () => {
		await lottery.methods.Enter().send({
			from: accounts[0],
			value: web3.utils.toWei("0.02", "ether"),
		});
		const players = await lottery.methods.getPlayers().call();
		assert.strictEqual(players[0], accounts[0]);
		assert.strictEqual(players.length, 1);
	});

	it("allows multiple accounts to enter", async () => {
		const num_player = 3;
		for (let i = 0; i < num_player; i++) {
			await lottery.methods.Enter().send({
				from: accounts[i],
				value: web3.utils.toWei("0.02", "ether"),
			});
			const players = await lottery.methods.getPlayers().call();
			assert.strictEqual(players[i], accounts[i]);
			assert.strictEqual(players.length, i + 1);
		}
	});

	it("requires a minimum amount of ether to enter", async () => {
		try {
			await lottery.methods.Enter().send({
				from: accounts[0],
				value: 0,
			});
			assert.fail("expected error not thrown");
		} catch (err) {
			if (!(err instanceof AssertionError)) assert(err);
			else
				assert.fail(
					"can enter pool with less than the minimum amount of ether required"
				);
		}
	});

	it("only manager can call pickWinner", async () => {
		try {
			await lottery.methods.pickWinner().send({
				from: accounts[1],
			});
			assert.fail("expected error not thrown");
		} catch (err) {
			if (!(err instanceof AssertionError)) assert(err);
			else assert.fail("non-manager can call pickWinner");
		}
	});

	it("sends money to the winner and resets the players array", async () => {
		await lottery.methods.Enter().send({
			from: accounts[1],
			value: web3.utils.toWei("2", "ether"),
		});

		const c_initialBalance = await web3.eth.getBalance(
			lottery.options.address
		);
		assert.strictEqual(c_initialBalance, web3.utils.toWei("2", "ether"));

		const initialBalance = await web3.eth.getBalance(accounts[1]);
		await lottery.methods.pickWinner().send({
			from: accounts[0],
		});

		const finalBalance = await web3.eth.getBalance(accounts[1]);
		const difference = (finalBalance - initialBalance).toString();
		assert.strictEqual(difference, web3.utils.toWei("2", "ether"));

		const players = await lottery.methods.getPlayers().call();
		assert.strictEqual(players.length, 0);

		const c_finalBalance = await web3.eth.getBalance(
			lottery.options.address
		);
		assert.strictEqual(c_finalBalance, "0");
	});
});
