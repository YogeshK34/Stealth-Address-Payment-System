

const BitGoJS = require("bitgo");

const bitgo = new BitGoJS.BitGo({
  env: "test",
  accessToken: "v2x8d5ed5007e87c2659afa879b85692eaf0520bc0d0271056c42407818c9d0f15e"
});

async function test() {

  const wallet = await bitgo.coin("tbtc").wallets().generateWallet({
  label: "hackathon-wallet",
  enterprise: "69b06b5cc64dd7edb993c5519a3ac334",
  passphrase: "strong-passphrase"
});

console.log(wallet);

}

test();
