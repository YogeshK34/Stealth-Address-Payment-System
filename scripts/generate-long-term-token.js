const BitGoJS = require("bitgo");
const readline = require("readline-sync");

const BitGo = BitGoJS.BitGo;

const bitgo = new BitGo({ env: "test" });

const username = "khutwadyogesh3003@gmail.com";
const password = "!2Soui903512345";

async function createAccessToken() {
  try {

    const loginOtp = readline.question("Enter OTP for login: ");

    await bitgo.authenticate({
      username,
      password,
      otp: loginOtp
    });

    console.log("Logged in successfully");

    const unlockOtp = readline.question("Enter OTP for unlock: ");

    await bitgo.unlock({ otp: unlockOtp });

    console.log("Session unlocked");

    const tokenOtp = readline.question("Enter OTP for token creation: ");

    const tokenResponse = await bitgo.addAccessToken({
      label: "hackathon-token",
      otp: tokenOtp,
      scope: ["wallet_view_all","wallet_spend"]
    });

    console.log("\n✅ Long-term access token:");
    console.log(tokenResponse.token);

  } catch (err) {
    console.error(err);
  }
}

createAccessToken();