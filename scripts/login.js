const BitGoJS = require('bitgo');

const BitGo = BitGoJS.BitGo;

const bitgo = new BitGo({
  env: 'test'
});

const username = "khutwadyogesh3003@gmail.com";
const password = "!2Soui903512345";
const otp = "320408";

bitgo.authenticate({ username, password, otp })
.then(function (response) {
  console.log("Login successful");
  console.log("Access Token:", response.access_token);
})
.catch(function (err) {
  console.error("Login failed:", err);
});
