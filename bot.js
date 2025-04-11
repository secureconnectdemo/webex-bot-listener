app.post("/webhook", async (req, res) => {
  const { data, resource } = req.body;
  const roomId = data.roomId;
  let webOrder = null;

  try {
    // ✅ Step 1: Handle Adaptive Card Submit via attachmentActions
    if (data && data.type === "submit") {
      const actionId = data.id;

      const actionRes = await axios.get(
        `https://webexapis.com/v1/attachment/actions/${actionId}`,
        {
          headers: { Authorization: WEBEX_BOT_TOKEN }
        }
      );

      if (actionRes.data && actionRes.data.inputs && actionRes.data.inputs.webOrder) {
        webOrder = actionRes.data.inputs.webOrder;
      }
    }

    // ✅ Step 2: Handle typed message
    if (!webOrder && data.id) {
      const messageRes = await axios.get(`https://webexapis.com/v1/messages/${data.id}`, {
        headers: { Authorization: WEBEX_BOT_TOKEN }
      });

      const text = messageRes.data.text?.toLowerCase().trim();

      if (text.includes("show orders")) {
        const options = await getWebOrderOptions();
        const choices = options.map(order => ({
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
              Authorization: WEBEX_BOT_TOKEN,
              "Content-Type": "application/json"
            }
          }
        );

        return res.sendStatus(200);
      }
    }

    // ✅ Step 3: Lookup and respond with customer data
    if (webOrder) {
      const customer = await getCustomerData(webOrder);

      const markdown = customer
        ? `📋 **Customer Info for ${webOrder}**  \n- Start Date: ${customer.startDate}  \n- Days Since Start: ${customer.daysSince}  \n- Onboarding Specialist: ${customer.specialist}  \n- Strategic CSS: ${customer.css}  \n- ARR: $${customer.arr}  \n- Sentiment: ${customer.sentiment}  \n- Stage: ${customer.stage}`
        : `⚠️ No data found for Web Order: **${webOrder}**`;

      await axios.post(
        "https://webexapis.com/v1/messages",
        {
          roomId,
          markdown
        },
        {
          headers: {
            Authorization: WEBEX_BOT_TOKEN,
            "Content-Type": "application/json"
          }
        }
      );
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Bot error:", error.response?.data || error.message);
    res.sendStatus(500);
  }
});
