const NewsIngestion = require('./services/newsIngestion');

async function test() {
  const ingestion = new NewsIngestion();
  const articles = await ingestion.ingestNews();
  console.log('Sample article:', articles[0]);
  console.log('Total articles:', articles.length);
}

test();