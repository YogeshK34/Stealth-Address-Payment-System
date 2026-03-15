const BitGoJS = require("bitgo");

const bitgo = new BitGoJS.BitGo({
  env: "test",
  accessToken: "v2x8d5ed5007e87c2659afa879b85692eaf0520bc0d0271056c42407818c9d0f15e"
});

const checkWalletBalance = async () => {
const wallet = await bitgo.coin("tbtc").wallets().get({
	id: "69b54ce46d11ec9197fb93491c5a5388"
});


console.log(wallet.balance());
};

checkWalletBalance();
