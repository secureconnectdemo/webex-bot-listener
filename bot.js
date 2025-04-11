const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

const WEBEX_BOT_TOKEN = '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E';
const CARD_SERVER_URL = 'https://webex-customer-card-server.onrender.com/card';

app.post('/webhook', async (req, res) => {
  const messageId = req.body.data.id;
  const roomId = req.body.data.roomId;

  try {
    const messageResp = await axios.get(`https://webexapis.com/v1/messages/${messageId}`, {
      headers: { Authorization: `Bearer ${WEBEX_BOT_TOKEN}` }
    });

    const text = messageResp.data.text.trim();
    if (!text.startsWith('WO-')) return res.sendStatus(200); // Ignore unrelated messages

    const response = await axios.post(CARD_SERVER_URL, { webOrder: text });

    await axios.post('https://webexapis.com/v1/messages', {
      roomId: roomId,
      markdown: `Customer info for ${text}`,
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: response.data
        }
      ]
    }, {
      headers: {
        Authorization: `Bearer ${WEBEX_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    res.sendStatus(200);
  } catch (err) {
    console.error('Error handling message:', err.message);
    res.sendStatus(500);
  }
});

app.get('/', (req, res) => res.send('Bot is running.'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🤖 Bot running on port ${PORT}`));