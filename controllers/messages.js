let messageModel = require("../schemas/messages");
let userModel = require("../schemas/users");
let mongoose = require("mongoose");

module.exports = {
  GetConversation: async function (currentUserId, otherUserId) {
    if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
      throw new Error("userId khong hop le");
    }
    const otherOid = new mongoose.Types.ObjectId(otherUserId);
    const currentOid = new mongoose.Types.ObjectId(currentUserId);
    const other = await userModel.findOne({ _id: otherOid, isDeleted: false });
    if (!other) {
      throw new Error("nguoi dung khong ton tai");
    }
    return messageModel
      .find({
        $or: [
          { from: currentOid, to: otherOid },
          { from: otherOid, to: currentOid }
        ]
      })
      .sort({ createdAt: 1 })
      .populate("from", "username fullName avatarUrl email")
      .populate("to", "username fullName avatarUrl email");
  },

  CreateMessage: async function (fromUserId, toUserId, messageContent) {
    if (!mongoose.Types.ObjectId.isValid(toUserId)) {
      throw new Error("to khong hop le");
    }
    const toOid = new mongoose.Types.ObjectId(toUserId);
    const fromOid = new mongoose.Types.ObjectId(fromUserId);
    if (fromOid.equals(toOid)) {
      throw new Error("khong the gui tin nhan cho chinh minh");
    }
    const recipient = await userModel.findOne({ _id: toOid, isDeleted: false });
    if (!recipient) {
      throw new Error("nguoi nhan khong ton tai");
    }
    if (!messageContent || typeof messageContent !== "object") {
      throw new Error("messageContent khong hop le");
    }
    const t = messageContent.type;
    if (t !== "text" && t !== "file") {
      throw new Error("messageContent.type phai la text hoac file");
    }
    if (typeof messageContent.text !== "string" || !messageContent.text.trim()) {
      throw new Error("messageContent.text khong duoc rong");
    }
    const doc = new messageModel({
      from: fromOid,
      to: toOid,
      messageContent: {
        type: t,
        text: messageContent.text.trim()
      }
    });
    await doc.save();
    return messageModel
      .findById(doc._id)
      .populate("from", "username fullName avatarUrl email")
      .populate("to", "username fullName avatarUrl email");
  },

  GetLastMessagePerPartner: async function (currentUserId) {
    const myId = new mongoose.Types.ObjectId(currentUserId);
    return messageModel.aggregate([
      { $match: { $or: [{ from: myId }, { to: myId }] } },
      { $sort: { createdAt: -1 } },
      {
        $addFields: {
          partnerId: {
            $cond: [{ $eq: ["$from", myId] }, "$to", "$from"]
          }
        }
      },
      { $group: { _id: "$partnerId", lastMessage: { $first: "$$ROOT" } } },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "partner"
        }
      },
      { $unwind: "$partner" },
      { $match: { "partner.isDeleted": false } },
      {
        $lookup: {
          from: "users",
          localField: "lastMessage.from",
          foreignField: "_id",
          as: "lmFrom"
        }
      },
      { $unwind: "$lmFrom" },
      {
        $lookup: {
          from: "users",
          localField: "lastMessage.to",
          foreignField: "_id",
          as: "lmTo"
        }
      },
      { $unwind: "$lmTo" },
      {
        $project: {
          _id: 0,
          partner: {
            _id: "$partner._id",
            username: "$partner.username",
            fullName: "$partner.fullName",
            avatarUrl: "$partner.avatarUrl",
            email: "$partner.email"
          },
          lastMessage: {
            _id: "$lastMessage._id",
            createdAt: "$lastMessage.createdAt",
            updatedAt: "$lastMessage.updatedAt",
            messageContent: "$lastMessage.messageContent",
            from: {
              _id: "$lmFrom._id",
              username: "$lmFrom.username",
              fullName: "$lmFrom.fullName",
              avatarUrl: "$lmFrom.avatarUrl",
              email: "$lmFrom.email"
            },
            to: {
              _id: "$lmTo._id",
              username: "$lmTo.username",
              fullName: "$lmTo.fullName",
              avatarUrl: "$lmTo.avatarUrl",
              email: "$lmTo.email"
            }
          }
        }
      },
      { $sort: { "lastMessage.createdAt": -1 } }
    ]);
  }
};
