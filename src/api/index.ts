// External API integration layer exports

// Fantasy platforms
export { 
  BaseFantasyClient, 
  ESPNClient, 
  YahooClient, 
  SleeperClient,
  PlatformAPIError,
  PlatformAuthConfig,
  FantasyPlatformClient,
  ESPNPlayerData,
  YahooPlayerData,
  SleeperPlayerData
} from './fantasy-platforms';

// News services  
export {
  BaseNewsClient,
  ESPNNewsClient,
  SportsDataClient,
  SentimentAnalyzer,
  NewsAPIError,
  ESPNNewsResponse,
  SentimentAnalysisResult
} from './news-services';

// Blog platforms
export {
  BaseBlogClient,
  WordPressClient,
  MediumClient,
  BlogPlatformError,
  BlogAuthConfig,
  BlogPlatformClient,
  WordPressPost,
  MediumPost
} from './blog-platform';

export * from './rate-limiter';
export * from './cache-manager';