var express = require("express");
var router = express.Router();
let { CheckLogin } = require("../utils/authHandler");
let messageController = require("../controllers/messages");
let { CreateMessageValidator, validatedResult } = require("../utils/validateHandler");

router.get("/", CheckLogin, async function (req, res, next) {
  try {
    let list = await messageController.GetLastMessagePerPartner(req.user._id);
    res.send(list);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.get("/:userId", CheckLogin, async function (req, res, next) {
  try {
    let messages = await messageController.GetConversation(
      req.user._id,
      req.params.userId
    );
    res.send(messages);
  } catch (err) {
    let status = err.message === "userId khong hop le" ? 400 : 404;
    res.status(status).send({ message: err.message });
  }
});

router.post(
  "/",
  CheckLogin,
  CreateMessageValidator,
  validatedResult,
  async function (req, res, next) {
    try {
      let saved = await messageController.CreateMessage(
        req.user._id,
        req.body.to,
        req.body.messageContent
      );
      res.status(201).send(saved);
    } catch (err) {
      let status = 400;
      if (
        err.message === "nguoi nhan khong ton tai" ||
        err.message === "to khong hop le"
      ) {
        status = 404;
      }
      res.status(status).send({ message: err.message });
    }
  }
);

module.exports = router;
