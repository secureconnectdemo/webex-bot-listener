const { getCustomerData } = require("./sheet");

const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const { google } = require("googleapis");
const keys = require("./credentials.json");

const app = express();
app.use(bodyParser.json());

const WEBEX_BOT_TOKEN = 'Bearer ZThjNjI1NDAtZmRkMC00YjUyLWJhMzktZWZmNDAyZmE3NTMzMzBkOGEzMjYtNzBi_PF84_1eb65fdf-9643-417f-9974-ad72cae0e10f';

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

app.post("/webhook", async (req, res) => {
  const messageId = req.body.data.id;
  const roomId = req.body.data.roomId;

  try {
    const message = await axios.get(`https://webexapis.com/v1/messages/${messageId}`, {
      headers: { Authorization: `Bearer ${WEBEX_BOT_TOKEN}` }
    });

    const text = message.data.text;

    let webOrder = text.trim();
    if (webOrder.includes(" ")) {
      webOrder = webOrder.split(" ").pop(); // In case of messages like "lookup WO-12345678"
    }

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
