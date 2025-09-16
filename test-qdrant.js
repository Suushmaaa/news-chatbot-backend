require('dotenv').config();
const { QdrantClient } = require('@qdrant/js-client-rest');

async function test() {
  const client = new QdrantClient({ 
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY
  });
  
  try {
    const collections = await client.getCollections();
    console.log('✅ Qdrant Cloud connected!');
    console.log('Collections:', collections);
  } catch (error) {
    console.error('❌ Qdrant connection failed:', error.message);
  }
}

test();