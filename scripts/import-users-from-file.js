/**
 * Đọc data/users-import.tsv (cột username, email cách nhau bằng TAB).
 * Tạo user (role thường) + cart giống POST /api/v1/auth/register.
 * Mật khẩu: chuỗi ngẫu nhiên 16 ký tự; gửi email qua Mailtrap (SMTP).
 *
 * Chuẩn bị: copy .env.example -> .env, điền MAILTRAP_USER / MAILTRAP_PASS.
 * Nếu DB chưa có role "user", script sẽ tự tạo một bản ghi role.
 * Chạy: npm run import-users
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const userController = require("../controllers/users");
const cartModel = require("../schemas/carts");
const roleModel = require("../schemas/roles");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/NNPTUD-S4";
const USERS_FILE = path.join(__dirname, "..", "data", "users-import.tsv");
const DEFAULT_USER_ROLE_OBJECT_ID = "69b0ddec842e41e8160132b8";

function generatePassword16() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(16);
  let s = "";
  for (let i = 0; i < 16; i++) s += chars[bytes[i] % chars.length];
  return s;
}

function parseUsersTsv(content) {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows = [];
  for (const line of lines) {
    if (/^username\s*\t/i.test(line)) continue;
    const parts = line.split("\t").map((p) => p.trim());
    if (parts.length >= 2 && parts[0] && parts[1]) {
      rows.push({ username: parts[0], email: parts[1].toLowerCase() });
    }
  }
  return rows;
}

async function resolveUserRoleId() {
  let role = await roleModel.findOne({ name: "user", isDeleted: false });
  if (!role) {
    role = await roleModel.findOne({ name: "Người dùng", isDeleted: false });
  }
  if (!role) {
    role = await roleModel.findOne({
      name: { $regex: /^user$/i },
      isDeleted: false,
    });
  }
  if (!role) {
    role = await roleModel.findById(DEFAULT_USER_ROLE_OBJECT_ID);
  }
  if (!role) {
    try {
      role = await roleModel.create({
        name: "user",
        description: "Người dùng thường",
      });
      console.log('Đã tạo role "user" trong DB (trước đó chưa có).');
    } catch (err) {
      role = await roleModel.findOne({ name: "user", isDeleted: false });
      if (!role) {
        throw new Error(
          'Không tạo được role "user": ' + (err.message || err)
        );
      }
    }
  }
  return role._id;
}

function createMailTransport() {
  const host = process.env.MAILTRAP_HOST || "sandbox.smtp.mailtrap.io";
  const port = Number(process.env.MAILTRAP_PORT || 2525);
  const user = process.env.MAILTRAP_USER;
  const pass = process.env.MAILTRAP_PASS;
  if (!user || !pass) {
    throw new Error("Thiếu MAILTRAP_USER hoặc MAILTRAP_PASS trong file .env");
  }
  return nodemailer.createTransport({
    host,
    port,
    auth: { user, pass },
  });
}

async function sendPasswordEmail(transport, { to, username, password }) {
  const from = process.env.MAIL_FROM || '"NNPTUD-S4" <noreply@example.com>';
  await transport.sendMail({
    from,
    to,
    subject: "[NNPTUD-S4] Mật khẩu tài khoản mới",
    text: [
      `Xin chào ${username},`,
      "",
      "Tài khoản của bạn đã được tạo trên hệ thống.",
      `- Username: ${username}`,
      `- Mật khẩu (16 ký tự): ${password}`,
      "",
      "Vui lòng đăng nhập và đổi mật khẩu nếu cần.",
    ].join("\n"),
    html: `<p>Xin chào <strong>${username}</strong>,</p>
<p>Tài khoản đã được tạo.</p>
<ul><li>Username: <code>${username}</code></li><li>Mật khẩu: <code>${password}</code></li></ul>`,
  });
}

async function main() {
  if (!fs.existsSync(USERS_FILE)) {
    throw new Error("Không thấy file: " + USERS_FILE);
  }

  await mongoose.connect(MONGODB_URI);
  const roleId = await resolveUserRoleId();
  const transport = createMailTransport();
  const entries = parseUsersTsv(fs.readFileSync(USERS_FILE, "utf8"));

  const summary = { created: 0, skipped: 0, emailFailed: [] };

  for (const { username, email } of entries) {
    const byName = await userController.GetAnUserByUsername(username);
    const byMail = await userController.GetAnUserByEmail(email);
    if (byName || byMail) {
      console.log("Bỏ qua (đã tồn tại):", username, email);
      summary.skipped++;
      continue;
    }

    const plainPassword = generatePassword16();
    let newUser;
    try {
      // Không dùng transaction: MongoDB standalone (mặc định trên Windows) không hỗ trợ.
      newUser = await userController.CreateAnUser(
        username,
        plainPassword,
        email,
        roleId,
        undefined
      );
      const newCart = new cartModel({ user: newUser._id });
      await newCart.save();
    } catch (err) {
      console.error("Lỗi tạo user:", username, err.message);
      continue;
    }

    summary.created++;
    try {
      await sendPasswordEmail(transport, {
        to: email,
        username,
        password: plainPassword,
      });
      console.log("Đã gửi mail:", username, "->", email);
    } catch (mailErr) {
      console.error("Gửi mail thất bại:", username, mailErr.message);
      summary.emailFailed.push({ username, email, error: mailErr.message });
    }
  }

  await mongoose.disconnect();
  console.log("\n--- Tổng kết ---");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
