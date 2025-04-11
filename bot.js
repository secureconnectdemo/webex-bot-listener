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

function getStageCounts(rows) {
  const counts = { Onboarding: 0, 'In Progress': 0, Completed: 0, Delayed: 0 };
  rows.forEach(row => {
    const stage = row[7]; // Column H = "Stage"
    if (counts[stage] !== undefined) counts[stage]++;
  });
  return counts;
}

function getStagePieChartUrl(stageCounts) {
  const chart = {
    type: 'pie',
    data: {
      labels: Object.keys(stageCounts),
      datasets: [{ data: Object.values(stageCounts) }]
    }
  };
  return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chart))}`;
}

app.post("/webhook", async (req, res) => {
  const { data, resource } = req.body;
  const roomId = data?.roomId;
  let webOrder = null;

  console.log("📩 Incoming webhook resource:", resource);
  console.log("📩 Webhook body:", JSON.stringify(req.body, null, 2));

  try {
    if (resource === "attachmentActions") {
      console.log("📨 Detected Adaptive Card Submission");

      const actionId = data.id;
      const actionRes = await axios.get(`https://webexapis.com/v1/attachment/actions/${actionId}`, {
        headers: { Authorization: WEBEX_BOT_TOKEN }
      });

      const inputs = actionRes.data.inputs;
      webOrder = inputs.webOrder;

      console.log("✅ Submitted webOrder:", webOrder);
    }

    if (!webOrder && data?.id) {
      const messageRes = await axios.get(`https://webexapis.com/v1/messages/${data.id}`, {
        headers: { Authorization: WEBEX_BOT_TOKEN }
      });

      const text = messageRes.data.text?.toLowerCase().trim();
      console.log("💬 Incoming message text:", text);

      if (text.includes("show orders")) {
        const options = await getWebOrderOptions();
        const choices = options.map(order => ({ title: order, value: order }));

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
              choices
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

        await axios.post("https://webexapis.com/v1/messages", {
          roomId,
          markdown: "Please select a Web Order:",
          attachments: [
            {
              contentType: "application/vnd.microsoft.card.adaptive",
              content: card
            }
          ]
        }, {
          headers: {
            Authorization: WEBEX_BOT_TOKEN,
            "Content-Type": "application/json"
          }
        });
        console.log("📤 Sent dropdown card");
        return res.sendStatus(200);
      }

      if (text.includes("stage report")) {
        const sheetId = "1YiP4zgb6jpAL1JyaiKs8Ud-MH11KTPkychc1y3_WirI";
        const range = "Sheet1!A2:H";
        const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
        const rows = res.data.values || [];
        const stageCounts = getStageCounts(rows);
        const chartUrl = getStagePieChartUrl(stageCounts);

        await axios.post("https://webexapis.com/v1/messages", {
          roomId,
          markdown: `📊 **Customer Stage Distribution**\n![Stage Chart](${chartUrl})`
        }, {
          headers: {
            Authorization: WEBEX_BOT_TOKEN,
            "Content-Type": "application/json"
          }
        });

        console.log("📈 Pie chart sent to Webex");
        return res.sendStatus(200);
      }
    }

    if (webOrder) {
      const customer = await getCustomerData(webOrder);
      console.log("📦 Customer data fetched:", customer);

      const markdown = customer
        ? `📋 **Customer Info for ${webOrder}**  \n- Start Date: ${customer.startDate}  \n- Days Since Start: ${customer.daysSince}  \n- Onboarding Specialist: ${customer.specialist}  \n- Strategic CSS: ${customer.css}  \n- ARR: $${customer.arr}  \n- Sentiment: ${customer.sentiment}  \n- Stage: ${customer.stage}`
        : `⚠️ No data found for Web Order: **${webOrder}**`;

      await axios.post("https://webexapis.com/v1/messages", {
        roomId,
        markdown
      }, {
        headers: {
          Authorization: WEBEX_BOT_TOKEN,
          "Content-Type": "application/json"
        }
      });

      console.log("✅ Info card sent to Webex");
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Bot error:", error.response?.data || error.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Bot server running on port ${PORT}`));