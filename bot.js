const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { google } = require("googleapis");
const keys = require("./credentials.json");

const app = express();
app.use(bodyParser.json());

const WEBEX_BOT_TOKEN = 'ZThjNjI1NDAtZmRkMC00YjUyLWJhMzktZWZmNDAyZmE3NTMzMzBkOGEzMjYtNzBi_PF84_1eb65fdf-9643-417f-9974-ad72cae0e10f';

const auth = new google.auth.JWT(
  keys.client_email,
  null,
  keys.private_key,
  ["https://www.googleapis.com/auth/spreadsheets.readonly"]
);

const sheets = google.sheets({ version: "v4", auth });

async function getCustomerData(webOrder) {
  const sheetId = "1YiP4zgb6jpAL1JyaiKs8Ud-MH11KTPkychc1y3_WirI";
  const range = "Sheet1!A2:H";

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: range
  });

  const rows = res.data.values;
  if (rows.length) {
    const match = rows.find(row => row[0] === webOrder);
    if (match) {
      return {
        startDate: match[1],
        daysSince: match[2],
        specialist: match[3],
        css: match[4],
        arr: match[5],
        sentiment: match[6],
        stage: match[7]
      };
    }
  }
  return null;
}

async function getWebOrderOptions() {
  const sheetId = "1YiP4zgb6jpAL1JyaiKs8Ud-MH11KTPkychc1y3_WirI";
  const range = "Sheet1!A2:A";

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: range
  });

  const rows = res.data.values || [];
  return rows.map(row => row[0]);
}

app.post("/webhook", async (req, res) => {
  const messageId = req.body.data.id;
  const roomId = req.body.data.roomId;

  try {
    let webOrder = null;

// If it's an Adaptive Card submission
if (req.body.data.inputs && req.body.data.inputs.webOrder) {
  webOrder = req.body.data.inputs.webOrder;
} else {
  // Otherwise, fallback to message lookup
  const message = await axios.get(`https://webexapis.com/v1/messages/${messageId}`, {
    headers: { Authorization: `Bearer ${WEBEX_BOT_TOKEN}` }
  });

  let text = message.data.text?.trim();
  if (text?.toLowerCase().includes("show orders")) {
    const webOrders = await getWebOrderOptions();
    const choices = webOrders.map(order => ({ title: order, value: order }));

    const card = {
      type: "AdaptiveCard",
      body: [
        {
          type: "TextBlock",
          text: "🔍 Choose a Web Order",
          weight: "Bolder",
          size: "Medium"
        },
        {
          type: "Input.ChoiceSet",
          id: "webOrder",
          placeholder: "Select a Web Order",
          choices: choices
        }
      ],
      actions: [
        {
          type: "Action.Submit",
          title: "Pull Customer Info"
        }
      ],
      $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
      version: "1.3"
    };

    await axios.post(
      "https://webexapis.com/v1/messages",
      {
        roomId,
        markdown: "Please select a Web Order:",
        attachments: [
          {
            contentType: "application/vnd.microsoft.card.adaptive",
            content: card
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
    return res.sendStatus(200);
  }

  // Fallback for regular messages
  if (text) {
    webOrder = text.split(" ").pop();
  }
}


    // 1. Handle Adaptive Card form submission
    if (req.body.data?.inputs?.webOrder) {
      webOrder = req.body.data.inputs.webOrder;
    }

    // 2. If typed "show orders" → send dropdown
    if (text?.toLowerCase().includes("show orders")) {
      const webOrders = await getWebOrderOptions();
      const choices = webOrders.map(order => ({
        title: order,
        value: order
      }));

      const card = {
        type: "AdaptiveCard",
        body: [
          {
            type: "TextBlock",
            text: "🔍 Choose a Web Order",
            weight: "Bolder",
            size: "Medium"
          },
          {
            type: "Input.ChoiceSet",
            id: "webOrder",
            placeholder: "Select a Web Order",
            choices: choices
          }
        ],
        actions: [
          {
            type: "Action.Submit",
            title: "Pull Customer Info"
          }
        ],
        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
        version: "1.3"
      };

      await axios.post(
        "https://webexapis.com/v1/messages",
        {
          roomId,
          markdown: "Please select a Web Order:",
          attachments: [
            {
              contentType: "application/vnd.microsoft.card.adaptive",
              content: card
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
      return res.sendStatus(200);
    }

    // 3. If not Adaptive or dropdown: try parsing last word as webOrder
    if (!webOrder && text) {
      if (text.includes(" ")) {
        webOrder = text.split(" ").pop();
      } else {
        webOrder = text;
      }
    }

    // 4. Lookup customer
    const customer = await getCustomerData(webOrder);
    let markdown;
    if (customer) {
      markdown = `📋 **Customer Info for ${webOrder}**  \n- Start Date: ${customer.startDate}  \n- Days Since Start: ${customer.daysSince}  \n- Onboarding Specialist: ${customer.specialist}  \n- Strategic CSS: ${customer.css}  \n- ARR: $${customer.arr}  \n- Sentiment: ${customer.sentiment}  \n- Stage: ${customer.stage}`;
    } else {
      markdown = `⚠️ No data found for Web Order: **${webOrder}**`;
    }

    await axios.post(
      "https://webexapis.com/v1/messages",
      {
        roomId,
        markdown
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
