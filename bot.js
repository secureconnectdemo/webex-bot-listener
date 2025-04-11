const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
app.use(bodyParser.json());

const WEBEX_BOT_TOKEN = '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E'; // Replace if needed

app.post("/webhook", async (req, res) => {
  const messageId = req.body.data.id;
  const roomId = req.body.data.roomId;

  try {
    const message = await axios.get(`https://webexapis.com/v1/messages/${messageId}`, {
      headers: { Authorization: WEBEX_BOT_TOKEN }
    });

    const text = message.data.text;

    await axios.post(
      "https://webexapis.com/v1/messages",
      {
        roomId,
        markdown: `👋 Bot received your message: **${text}**`
      },
      {
        headers: {
          Authorization: WEBEX_BOT_TOKEN,
          "Content-Type": "application/json"
        }
      }
    );

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Bot error:", error.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Bot server running on port ${PORT}`));
