const BitGoJS = require("bitgo");

const bitgo = new BitGoJS.BitGo({
  env: "test",
  accessToken: "v2x8d5ed5007e87c2659afa879b85692eaf0520bc0d0271056c42407818c9d0f15e"
});

const checkWalletBalance = async () => {
const wallet = await bitgo.coin("tbtc").wallets().get({
	id: "69b2669dadde7fcd17eb37c46ee964be"
});


console.log(wallet.balance());
};

checkWalletBalance();
