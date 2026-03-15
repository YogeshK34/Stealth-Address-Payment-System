const BitGoJS = require("bitgo");

const bitgo = new BitGoJS.BitGo({
  env: "test",
  accessToken: "v2x8d5ed5007e87c2659afa879b85692eaf0520bc0d0271056c42407818c9d0f15e"
});

const walletId = "69b2669dadde7fcd17eb37c46ee964be";

async function sendTransaction() {

  const wallet = await bitgo.coin("tbtc").wallets().get({
    id: walletId
  });

  console.log(wallet.confirmedBalance());
console.log(wallet.balance());
console.log(wallet.spendableBalance());

  const result = await wallet.send({
    address: "tb1pantf20u93x900g92r5g5j9lj3p2cv33zm8v67wnved7zh5yadtpqg4q54s",
    amount: 10000, // satoshis (0.0001 TBTC)
    walletPassphrase: "strong-passphrase"
  });

  console.log("Transaction sent:");
  console.log(result);
}

sendTransaction();
