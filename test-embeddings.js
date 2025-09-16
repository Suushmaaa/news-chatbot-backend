require('dotenv').config();
const JinaEmbeddings = require('./services/jinaEmbeddings');

async function test() {
  const jina = new JinaEmbeddings();
  
  try {
    const embedding = await jina.createSingleEmbedding("This is a test news article about technology");
    console.log('Embedding dimension:', embedding.length);
    console.log('First 5 values:', embedding.slice(0, 5));
    console.log('✅ Jina embeddings working!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test();