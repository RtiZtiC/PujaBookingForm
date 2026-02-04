// Vercel Serverless Function for Shopify Draft Order Creation
// Place this file at: /api/create-draft-order.js

export default async function handler(req, res) {
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
    
    // Get environment variables
    const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
    const SHOPIFY_ADMIN_API_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;
    const SHOPIFY_API_VERSION = '2024-01';
    
    if (!SHOPIFY_STORE_URL || !SHOPIFY_ADMIN_API_TOKEN) {
      return res.status(500).json({
        success: false,
        error: 'Missing required environment variables'
      });
    }
    
    // Execute GraphQL mutation using fetch
    const shopifyResponse = await fetch(
      `https://${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_TOKEN
        },
        body: JSON.stringify({
          query: mutation,
          variables: variables
        })
      }
    );
    
    const shopifyData = await shopifyResponse.json();
    
    console.log('Shopify response:', JSON.stringify(shopifyData, null, 2));
    
    // Check for errors
    if (shopifyData.errors) {
      console.error('GraphQL errors:', shopifyData.errors);
      return res.status(400).json({
        success: false,
        errors: shopifyData.errors
      });
    }
    
    const draftOrder = shopifyData.data?.draftOrderCreate?.draftOrder;
    const userErrors = shopifyData.data?.draftOrderCreate?.userErrors;
    
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
    
    return res.status(200).json({
      success: true,
      data: shopifyData.data,
      draftOrder: {
        id: draftOrder.id,
        name: draftOrder.name,
        invoiceUrl: draftOrder.invoiceUrl
      }
    });
    
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
