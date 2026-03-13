const BitGoJS = require("bitgo");

const bitgo = new BitGoJS.BitGo({
  env: "test",
  accessToken: "v2x043ca12853a8be8f2100cd0fd464794ab422ab8f029113854ef07c4b465e08ad"
});

async function run() {

  const wallets = await bitgo.coin("tbtc").wallets().list();

  // const wallet = wallets.wallets[0];

  // console.log("Wallet ID:", wallet.id());
  // console.log("Balance:", wallet.balance());
   console.log(wallets);
}

run();
