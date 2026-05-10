exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const body = JSON.parse(event.body);
    const price = parseFloat(body.price || body.amount);
    const tokens = body.tokens || "";
    const packId = body.packId || body.description || "";

    console.log("Données reçues:", { packId, tokens, price });

    if (!price || isNaN(price)) {
      return { statusCode: 400, body: JSON.stringify({ error: "Prix invalide" }) };
    }

    const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
    const PAYPAL_SECRET = process.env.PAYPAL_SECRET;

    if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
      return { statusCode: 500, body: JSON.stringify({ error: "Variables PayPal manquantes" }) };
    }

    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');

    const tokenRes = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("Token PayPal échoué:", tokenData);
      return { statusCode: 500, body: JSON.stringify({ error: "Auth PayPal échouée" }) };
    }

    const accessToken = tokenData.access_token;

    const orderRes = await fetch("https://api-m.sandbox.paypal.com/v2/checkout/orders", {
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
        }]
      })
    });

    const orderData = await orderRes.json();
    console.log("Réponse PayPal complète:", JSON.stringify(orderData));

    if (orderData.id) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderData.id })
      };
    } else {
      console.error("Réponse PayPal:", orderData);
      throw new Error("Impossible de créer la commande PayPal");
    }

  } catch (err) {
    console.error("Erreur create-paypal-order:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
