// Backend Endpoint for Shopify GraphQL Draft Order Creation
// Deploy this to Vercel, Netlify, or your own Node.js server

const https = require('https');

// Configuration
const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL; // e.g., 'digitalpuja.myshopify.com'
const SHOPIFY_ADMIN_API_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN; // Admin API access token
const SHOPIFY_API_VERSION = '2024-01'; // GraphQL API version

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { mutation, variables, paymentId, totalAmount } = req.body;
    
    console.log('Creating draft order for payment:', paymentId);
    console.log('Total amount:', totalAmount);
    
    // Execute GraphQL mutation
    const shopifyResponse = await executeShopifyGraphQL(mutation, variables);
    
    console.log('Shopify response:', JSON.stringify(shopifyResponse, null, 2));
    
    // Check for errors
    if (shopifyResponse.errors) {
      console.error('GraphQL errors:', shopifyResponse.errors);
      return res.status(400).json({
        success: false,
        errors: shopifyResponse.errors
      });
    }
    
    const draftOrder = shopifyResponse.data?.draftOrderCreate?.draftOrder;
    const userErrors = shopifyResponse.data?.draftOrderCreate?.userErrors;
    
    if (userErrors && userErrors.length > 0) {
      console.error('User errors:', userErrors);
      return res.status(400).json({
        success: false,
        errors: userErrors
      });
    }
    
    if (!draftOrder) {
      console.error('No draft order in response');
      return res.status(500).json({
        success: false,
        error: 'Failed to create draft order'
      });
    }
    
    console.log('Draft order created successfully:', draftOrder.name);
    
    // Optional: Mark draft order as paid using another mutation
    // This requires a separate GraphQL mutation - see below
    
    return res.status(200).json({
      success: true,
      data: shopifyResponse.data
    });
    
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Execute Shopify GraphQL request
function executeShopifyGraphQL(query, variables) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      query: query,
      variables: variables
    });
    
    const options = {
      hostname: SHOPIFY_STORE_URL,
      path: `/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_TOKEN
      }
    };
    
    const shopifyReq = https.request(options, (shopifyRes) => {
      let responseData = '';
      
      shopifyRes.on('data', (chunk) => {
        responseData += chunk;
      });
      
      shopifyRes.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve(parsedData);
        } catch (error) {
          reject(new Error('Failed to parse Shopify response: ' + error.message));
        }
      });
    });
    
    shopifyReq.on('error', (error) => {
      reject(new Error('Shopify request failed: ' + error.message));
    });
    
    shopifyReq.write(data);
    shopifyReq.end();
  });
}

// Optional: Function to complete draft order and mark as paid
async function completeDraftOrder(draftOrderId, paymentId, totalAmount) {
  const mutation = `
    mutation draftOrderComplete($id: ID!, $paymentPending: Boolean) {
      draftOrderComplete(id: $id, paymentPending: $paymentPending) {
        draftOrder {
          id
          order {
            id
            name
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  
  const variables = {
    id: draftOrderId,
    paymentPending: false // Set to false since payment is already done via Razorpay
  };
  
  try {
    const result = await executeShopifyGraphQL(mutation, variables);
    
    if (result.data?.draftOrderComplete?.order) {
      console.log('Draft order completed, Order ID:', result.data.draftOrderComplete.order.name);
      
      // Now mark the order as paid with a transaction
      const orderId = result.data.draftOrderComplete.order.id;
      await markOrderAsPaid(orderId, paymentId, totalAmount);
      
      return result.data.draftOrderComplete.order;
    }
    
    return null;
  } catch (error) {
    console.error('Error completing draft order:', error);
    throw error;
  }
}

// Function to mark order as paid
async function markOrderAsPaid(orderId, paymentId, totalAmount) {
  // Note: This requires a financial transaction mutation
  // Shopify doesn't allow marking external payments via GraphQL easily
  // You'll need to use REST API or manually mark orders as paid
  
  console.log('Order needs to be marked as paid manually or via Shopify Flow');
  console.log('Order ID:', orderId);
  console.log('Payment ID:', paymentId);
  console.log('Amount:', totalAmount);
  
  // You can log this to a database or send a webhook to mark it later
}
