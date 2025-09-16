const xml2js = require('xml2js');
const { v4: uuidv4 } = require('uuid');

class NewsIngestion {
  constructor() {
    // Simple, reliable RSS feeds
    this.rssFeeds = [
      'https://feeds.bbci.co.uk/news/world/rss.xml',
      'https://rss.cnn.com/rss/edition.rss',
      'https://feeds.reuters.com/reuters/topNews',
      'https://feeds.skynews.com/feeds/rss/world.xml'
    ];
  }

  async fetchRSSFeed(url) {
    try {
      console.log(`📡 Fetching RSS feed: ${url}`);
      
      // Use native fetch (Node 18+) or require node-fetch
      let fetch;
      try {
        fetch = globalThis.fetch;
      } catch {
        fetch = require('node-fetch');
      }
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const xmlData = await response.text();
      console.log(`✅ Fetched ${xmlData.length} characters from ${url}`);
      
      const parser = new xml2js.Parser({ 
        explicitArray: false,
        ignoreAttrs: false 
      });
      
      const result = await parser.parseStringPromise(xmlData);
      
      // Handle different RSS formats
      let items = [];
      if (result.rss && result.rss.channel && result.rss.channel.item) {
        items = Array.isArray(result.rss.channel.item) 
          ? result.rss.channel.item 
          : [result.rss.channel.item];
      } else if (result.feed && result.feed.entry) {
        items = Array.isArray(result.feed.entry) 
          ? result.feed.entry 
          : [result.feed.entry];
      }
      
      console.log(`📰 Found ${items.length} articles in RSS feed`);
      return items;
      
    } catch (error) {
      console.error(`❌ Error fetching RSS ${url}:`, error.message);
      return [];
    }
  }

  parseArticle(item, source) {
    try {
      // Handle different RSS formats
      const title = item.title || item.title?._ || 'Untitled';
      const description = item.description || item.summary || item.content || '';
      const link = item.link || item.link?.$ || item.id || '';
      const pubDate = item.pubDate || item.published || item.updated || new Date().toISOString();
      
      // Clean up HTML tags from description
      const cleanDescription = description.toString()
        .replace(/<[^>]*>/g, '')
        .replace(/&[^;]+;/g, ' ')
        .trim();
      
      if (title && cleanDescription.length > 50) {
        return {
          id: uuidv4(),
          title: title.toString().trim(),
          content: cleanDescription,
          url: link.toString(),
          publishDate: pubDate.toString(),
          source: source
        };
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error parsing article:', error.message);
      return null;
    }
  }

  async ingestNews() {
    console.log('🚀 Starting news ingestion...');
    const allArticles = [];
    
    for (const feedUrl of this.rssFeeds) {
      try {
        const items = await this.fetchRSSFeed(feedUrl);
        const source = new URL(feedUrl).hostname;
        
        let articlesFromFeed = 0;
        
        for (const item of items.slice(0, 15)) { // Limit per feed
          const article = this.parseArticle(item, source);
          if (article) {
            allArticles.push(article);
            articlesFromFeed++;
          }
        }
        
        console.log(`✅ Added ${articlesFromFeed} articles from ${source}`);
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Failed to process feed ${feedUrl}:`, error.message);
      }
    }
    
    console.log(`🎉 Total ingested: ${allArticles.length} articles`);
    return allArticles;
  }

  // Test method for single feed
  async testSingleFeed() {
    console.log('🧪 Testing single RSS feed...');
    const testFeed = 'https://feeds.bbci.co.uk/news/world/rss.xml';
    const items = await this.fetchRSSFeed(testFeed);
    
    if (items.length > 0) {
      console.log('✅ RSS parsing works!');
      console.log('Sample item:', JSON.stringify(items[0], null, 2));
      
      const article = this.parseArticle(items[0], 'bbc.co.uk');
      console.log('Parsed article:', article);
      return true;
    } else {
      console.log('❌ No items found');
      return false;
    }
  }
}

module.exports = NewsIngestion;