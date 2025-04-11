const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
app.use(bodyParser.json());

const WEBEX_BOT_TOKEN = 'ZThjNjI1NDAtZmRkMC00YjUyLWJhMzktZWZmNDAyZmE3NTMzMzBkOGEzMjYtNzBi_PF84_1eb65fdf-9643-417f-9974-ad72cae0e10f'; // ✅ Do NOT prepend 'Bearer ' here

const adaptiveCard = {
  type: "AdaptiveCard",
  body: [
    {
      type: "TextBlock",
      text: "🔎 Customer Onboarding Lookup",
      weight: "Bolder",
      size: "Medium",
      wrap: true
    },
    {
      type: "Input.Text",
      id: "webOrder",
      placeholder: "Enter Web Order Number",
      style: "text",
      value: "WO-12345678"
    },
    {
      type: "ActionSet",
      actions: [
        {
          type: "Action.Submit",
          title: "Pull Customer Info"
        }
      ]
    },
    {
      type: "TextBlock",
      text: "**Customer Details**",
      weight: "Bolder",
      spacing: "Medium",
      separator: true
    },
    {
      type: "FactSet",
      facts: [
        { title: "Requested Start Date:", value: "March 5, 2025" },
        { title: "Days Since Start Date:", value: "36 days" },
        { title: "Onboarding Specialist:", value: "Alex Ramirez" },
        { title: "Strategic CSS:", value: "Jennifer Lee" },
        { title: "License Type:", value: "Secure Access - Advanced" },
        { title: "ARR:", value: "$82,000" },
        { title: "Customer Contact:", value: "maria.santos@acmecorp.com" },
        { title: "Sentiment:", value: "Positive" },
        { title: "Current Stage:", value: "Onboarding" },
        { title: "Business Outcome:", value: "Enable secure hybrid work for 1000 remote employees" },
        { title: "Progress:", value: "70% – Core pilot complete" },
        { title: "Feature Requests:", value: "ZTA Clientless, SAML IDP Failover" },
        { title: "Active Cases:", value: "3 Open (INC12345, INC12789, SR99881)" },
        { title: "Advocacy Program Restrictions:", value: "Pending NDA signature" }
      ]
    }
  ],
  $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
  version: "1.3"
};

app.post("/webhook", async (req, res) => {
  const messageId = req.body.data.id;
  const roomId = req.body.data.roomId;

  try {
    const message = await axios.get(`https://webexapis.com/v1/messages/${messageId}`, {
      headers: { Authorization: `Bearer ${WEBEX_BOT_TOKEN}` } // ✅ Correct Bearer usage
    });

    const text = message.data.text;

    await axios.post(
      "https://webexapis.com/v1/messages",
      {
        roomId,
        markdown: "Here's the onboarding summary:",
        attachments: [
          {
            contentType: "application/vnd.microsoft.card.adaptive",
            content: adaptiveCard
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${WEBEX_BOT_TOKEN}`,
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
