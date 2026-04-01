/**
 * Chạy: node scripts/seed-demo-user.js
 * Cần MongoDB bật (mongodb://localhost:27017/NNPTUD-S4).
 * Tạo 2 user demo để test login + messages (cần 2 user cho hội thoại).
 */
require("dotenv").config();
const mongoose = require("mongoose");
const userModel = require("../schemas/users");
const roleModel = require("../schemas/roles");
const cartModel = require("../schemas/carts");

const URI = process.env.MONGODB_URI || "mongodb://localhost:27017/NNPTUD-S4";

const ACCOUNTS = [
  {
    username: "demopostman",
    email: "demopostman@test.local",
    password: "Demo@12345"
  },
  {
    username: "demopostman2",
    email: "demopostman2@test.local",
    password: "Demo@12345"
  }
];

async function main() {
  await mongoose.connect(URI);
  let role = await roleModel.findOne({ isDeleted: false }).sort({ createdAt: 1 });
  if (!role) {
    role = await roleModel.create({
      name: "USER",
      description: "Demo role",
      isDeleted: false
    });
    console.log("Đã tạo role:", role.name, role._id.toString());
  }

  console.log("\n--- Dùng trong Postman (login / register body JSON) ---\n");

  for (const acc of ACCOUNTS) {
    const exists = await userModel.findOne({
      username: acc.username,
      isDeleted: false
    });
    if (exists) {
      console.log(`Đã tồn tại: ${acc.username} (bỏ qua tạo mới)`);
      console.log(JSON.stringify({ username: acc.username, password: acc.password }, null, 2));
      continue;
    }
    try {
      const u = new userModel({
        username: acc.username,
        password: acc.password,
        email: acc.email,
        role: role._id,
        fullName: acc.username,
        isDeleted: false
      });
      await u.save();
      await new cartModel({ user: u._id }).save();
      console.log(`Đã tạo user: ${acc.username}`);
      console.log(JSON.stringify({ username: acc.username, password: acc.password }, null, 2));
    } catch (e) {
      console.error("Lỗi:", acc.username, e.message);
    }
  }

  console.log("\n--- Gợi ý test messages ---");
  const u1 = await userModel.findOne({ username: "demopostman" });
  const u2 = await userModel.findOne({ username: "demopostman2" });
  if (u1 && u2) {
    console.log("userId demopostman:  ", u1._id.toString());
    console.log("userId demopostman2:", u2._id.toString());
    console.log('POST /messages: "to" = _id của user kia.\n');
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
