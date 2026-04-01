const mongoose = require("mongoose");

const messageContentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["file", "text"],
      required: [true, "messageContent.type is required"]
    },
    text: {
      type: String,
      required: [true, "messageContent.text is required"]
    }
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: [true, "from is required"]
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: [true, "to is required"]
    },
    messageContent: {
      type: messageContentSchema,
      required: [true, "messageContent is required"]
    }
  },
  { timestamps: true }
);

messageSchema.index({ from: 1, to: 1, createdAt: -1 });

module.exports = mongoose.model("message", messageSchema);
