import bcrypt from "bcrypt";

const inputPassword = "freqitxyz123";
const hash = "$2b$10$7.zbsrSX/Zh6CmlHnNHuuuUtluFb1Tj4GXOFOGerNiNv1MTe.4mCi";

const isMatch = await bcrypt.compare(inputPassword, hash);
console.log(isMatch);
