const BitGoJS = require("bitgo");

const bitgo = new BitGoJS.BitGo({
  env: "test",
  accessToken: "v2x8d5ed5007e87c2659afa879b85692eaf0520bc0d0271056c42407818c9d0f15e"
});

const checkWalletBalance = async () => {
const wallet = await bitgo.coin("tbtc").wallets().get({
	id: "69b52976c5e246bcfad88f9958950827"
});


console.log(wallet.balance());
};

checkWalletBalance();
