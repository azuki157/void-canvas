const https = require('https');

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { sessionId, packId, tokens, price } = JSON.parse(event.body);

    // 1️⃣ Obtenir l'access token
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');
    
    const tokenRes = await fetch("https://api.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // 2️⃣ Créer la commande
    const orderRes = await fetch("https://api.paypal.com/v2/checkout/orders", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          amount: {
            currency_code: "EUR",
            value: price.toFixed(2)
          },
          description: `${tokens} tokens - ${packId}`
        }],
        return_url: `${process.env.URL || 'http://localhost:8888'}?token={id}`,
        cancel_url: `${process.env.URL || 'http://localhost:8888'}`
      })
    });

    const orderData = await orderRes.json();

    if (orderData.id) {
      return {
        statusCode: 200,
        body: JSON.stringify({ id: orderData.id })
      };
    } else {
      throw new Error("Impossible de créer la commande");
    }
  } catch (err) {
    console.error("create-paypal-order error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
