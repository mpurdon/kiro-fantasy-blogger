// News sentiment analysis utilities

import { NewsArticle } from '../../models/player';
import { SentimentAnalysisResult } from './types';

export class SentimentAnalyzer {
  private positiveKeywords: Set<string>;
  private negativeKeywords: Set<string>;
  private injuryKeywords: Set<string>;
  private performanceKeywords: Set<string>;

  constructor() {
    this.positiveKeywords = new Set([
      'breakout', 'explosive', 'dominant', 'excellent', 'outstanding', 'impressive',
      'strong', 'solid', 'good', 'great', 'fantastic', 'amazing', 'stellar',
      'productive', 'efficient', 'effective', 'successful', 'promising',
      'upside', 'potential', 'opportunity', 'target', 'featured', 'starter',
      'healthy', 'recovered', 'return', 'comeback', 'cleared', 'activated'
    ]);

    this.negativeKeywords = new Set([
      'injured', 'hurt', 'questionable', 'doubtful', 'out', 'sidelined',
      'struggling', 'poor', 'bad', 'terrible', 'awful', 'disappointing',
      'concerning', 'worry', 'problem', 'issue', 'decline', 'drop',
      'benched', 'demoted', 'limited', 'restricted', 'suspended',
      'fumble', 'interception', 'turnover', 'penalty', 'fine'
    ]);

    this.injuryKeywords = new Set([
      'injury', 'injured', 'hurt', 'pain', 'strain', 'sprain', 'tear',
      'fracture', 'concussion', 'surgery', 'mri', 'x-ray', 'diagnosis',
      'treatment', 'rehab', 'recovery', 'healing', 'rest', 'ir',
      'injured reserve', 'questionable', 'doubtful', 'out', 'dnp'
    ]);

    this.performanceKeywords = new Set([
      'yards', 'touchdown', 'reception', 'carry', 'target', 'snap',
      'fantasy', 'points', 'score', 'performance', 'stats', 'statistics',
      'production', 'output', 'efficiency', 'usage', 'workload', 'role'
    ]);
  }

  public analyzeArticle(article: NewsArticle): SentimentAnalysisResult {
    const text = `${article.title} ${article.summary}`.toLowerCase();
    const words = this.tokenize(text);
    
    let positiveScore = 0;
    let negativeScore = 0;
    const foundKeywords: string[] = [];
    
    // Analyze each word
    for (const word of words) {
      if (this.positiveKeywords.has(word)) {
        positiveScore++;
        foundKeywords.push(word);
      } else if (this.negativeKeywords.has(word)) {
        negativeScore++;
        foundKeywords.push(word);
      }
    }

    // Special handling for injury-related content
    const hasInjuryContent = words.some(word => this.injuryKeywords.has(word));
    if (hasInjuryContent) {
      negativeScore += 2; // Injury news is generally negative for fantasy
      foundKeywords.push('injury-related');
    }

    // Calculate sentiment
    const totalScore = positiveScore + negativeScore;
    let sentiment: 'positive' | 'neutral' | 'negative';
    let confidence: number;

    if (totalScore === 0) {
      sentiment = 'neutral';
      confidence = 0.5;
    } else {
      const positiveRatio = positiveScore / totalScore;
      
      if (positiveRatio > 0.6) {
        sentiment = 'positive';
        confidence = Math.min(0.9, 0.5 + (positiveRatio - 0.6) * 1.25);
      } else if (positiveRatio < 0.4) {
        sentiment = 'negative';
        confidence = Math.min(0.9, 0.5 + (0.4 - positiveRatio) * 1.25);
      } else {
        sentiment = 'neutral';
        confidence = 0.6;
      }
    }

    return {
      sentiment,
      confidence: Math.round(confidence * 100) / 100,
      keywords: [...new Set(foundKeywords)],
      reasoning: this.generateReasoning(sentiment, positiveScore, negativeScore, hasInjuryContent)
    };
  }

  public analyzeMultipleArticles(articles: NewsArticle[]): {
    overall: SentimentAnalysisResult;
    individual: SentimentAnalysisResult[];
  } {
    const individual = articles.map(article => this.analyzeArticle(article));
    
    // Calculate overall sentiment
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    let totalConfidence = 0;
    const allKeywords: string[] = [];

    for (const result of individual) {
      sentimentCounts[result.sentiment]++;
      totalConfidence += result.confidence;
      allKeywords.push(...result.keywords);
    }

    const totalArticles = articles.length;
    const avgConfidence = totalArticles > 0 ? totalConfidence / totalArticles : 0;
    
    // Determine overall sentiment
    let overallSentiment: 'positive' | 'neutral' | 'negative';
    if (sentimentCounts.positive > sentimentCounts.negative) {
      overallSentiment = 'positive';
    } else if (sentimentCounts.negative > sentimentCounts.positive) {
      overallSentiment = 'negative';
    } else {
      overallSentiment = 'neutral';
    }

    const overall: SentimentAnalysisResult = {
      sentiment: overallSentiment,
      confidence: Math.round(avgConfidence * 100) / 100,
      keywords: [...new Set(allKeywords)],
      reasoning: `Based on ${totalArticles} articles: ${sentimentCounts.positive} positive, ${sentimentCounts.neutral} neutral, ${sentimentCounts.negative} negative`
    };

    return { overall, individual };
  }

  public categorizeNews(articles: NewsArticle[]): {
    injury: NewsArticle[];
    performance: NewsArticle[];
    general: NewsArticle[];
  } {
    const categories = {
      injury: [] as NewsArticle[],
      performance: [] as NewsArticle[],
      general: [] as NewsArticle[]
    };

    for (const article of articles) {
      const text = `${article.title} ${article.summary}`.toLowerCase();
      const words = this.tokenize(text);
      
      const hasInjuryKeywords = words.some(word => this.injuryKeywords.has(word));
      const hasPerformanceKeywords = words.some(word => this.performanceKeywords.has(word));
      
      if (hasInjuryKeywords) {
        categories.injury.push(article);
      } else if (hasPerformanceKeywords) {
        categories.performance.push(article);
      } else {
        categories.general.push(article);
      }
    }

    return categories;
  }

  public extractFantasyRelevantNews(articles: NewsArticle[]): NewsArticle[] {
    const fantasyKeywords = new Set([
      'fantasy', 'start', 'sit', 'waiver', 'pickup', 'drop', 'trade',
      'target', 'snap', 'usage', 'workload', 'role', 'opportunity',
      'touchdown', 'yards', 'reception', 'carry', 'points', 'production'
    ]);

    return articles.filter(article => {
      const text = `${article.title} ${article.summary}`.toLowerCase();
      const words = this.tokenize(text);
      
      return words.some(word => fantasyKeywords.has(word)) ||
             words.some(word => this.performanceKeywords.has(word));
    });
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  private generateReasoning(
    sentiment: 'positive' | 'neutral' | 'negative',
    positiveScore: number,
    negativeScore: number,
    hasInjuryContent: boolean
  ): string {
    if (sentiment === 'positive') {
      return `Positive sentiment detected with ${positiveScore} positive indicators${negativeScore > 0 ? ` and ${negativeScore} negative indicators` : ''}`;
    } else if (sentiment === 'negative') {
      return `Negative sentiment detected with ${negativeScore} negative indicators${positiveScore > 0 ? ` and ${positiveScore} positive indicators` : ''}${hasInjuryContent ? ', including injury-related content' : ''}`;
    } else {
      return `Neutral sentiment with balanced or minimal sentiment indicators (${positiveScore} positive, ${negativeScore} negative)`;
    }
  }

  public getKeywordStats(): {
    positiveCount: number;
    negativeCount: number;
    injuryCount: number;
    performanceCount: number;
  } {
    return {
      positiveCount: this.positiveKeywords.size,
      negativeCount: this.negativeKeywords.size,
      injuryCount: this.injuryKeywords.size,
      performanceCount: this.performanceKeywords.size
    };
  }

  public addCustomKeywords(type: 'positive' | 'negative' | 'injury' | 'performance', keywords: string[]): void {
    const targetSet = this.getKeywordSet(type);
    keywords.forEach(keyword => targetSet.add(keyword.toLowerCase()));
  }

  public removeCustomKeywords(type: 'positive' | 'negative' | 'injury' | 'performance', keywords: string[]): void {
    const targetSet = this.getKeywordSet(type);
    keywords.forEach(keyword => targetSet.delete(keyword.toLowerCase()));
  }

  private getKeywordSet(type: 'positive' | 'negative' | 'injury' | 'performance'): Set<string> {
    switch (type) {
      case 'positive':
        return this.positiveKeywords;
      case 'negative':
        return this.negativeKeywords;
      case 'injury':
        return this.injuryKeywords;
      case 'performance':
        return this.performanceKeywords;
      default:
        throw new Error(`Unknown keyword type: ${type}`);
    }
  }
}