const fs = require("fs");
const path = require("path");

const source = path.join(__dirname, "public", "main.js");
const destination = path.join(__dirname, "build", "main.js");

if (!fs.existsSync(destination)) {
  fs.copyFileSync(source, destination);
  console.log("main.js를 build 폴더로 복사했습니다.");
} else {
  console.log("build 폴더에 main.js가 이미 존재합니다.");
}
