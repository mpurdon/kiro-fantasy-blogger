// Analysis Agent implementation for evaluating players and generating FAAB recommendations

import { BaseAgent, AnalysisAgent as IAnalysisAgent } from './interfaces';
import { 
  PlayerResearch, 
  PlayerAnalysis, 
  PlayerSummary,
  PlayerStats,
  InjuryReport,
  Matchup,
  PerformanceMetrics
} from '../models/player';
import { NewsAndAnalysisValidator } from '../models/player';

export class AnalysisAgent implements BaseAgent, IAnalysisAgent {
  public readonly name = 'AnalysisAgent';
  private initialized = false;

  constructor() {}

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('Initializing Analysis Agent...');
    this.initialized = true;
    console.log('Analysis Agent initialized successfully');
  }

  public async execute(input: PlayerResearch[]): Promise<PlayerAnalysis[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    console.log(`Starting analysis for ${input.length} players...`);
    const analyses: PlayerAnalysis[] = [];

    for (const research of input) {
      try {
        const analysis = await this.analyzePlayer(research);
        analyses.push(analysis);
      } catch (error) {
        console.error(`Failed to analyze player ${research.player.name}:`, error);
        
        // Create fallback analysis for failed players
        const fallbackAnalysis = this.createFallbackAnalysis(research.player);
        analyses.push(fallbackAnalysis);
      }
    }

    console.log(`Analysis completed for ${analyses.length} players`);
    return analyses;
  }

  public async cleanup(): Promise<void> {
    console.log('Analysis Agent cleanup completed');
  }

  public async analyzePlayer(research: PlayerResearch): Promise<PlayerAnalysis> {
    console.log(`Analyzing player: ${research.player.name}`);

    // Task 6.1: Player evaluation algorithms
    const faabValue = this.assessFAABValue(research);
    const rosterImpact = this.assessRosterImpact(research);
    const sustainability = this.assessSustainability(research);
    const riskFactors = this.identifyRiskFactors(research);
    const upside = this.identifyUpside(research);

    // Task 6.2: Recommendation generation
    const recommendation = this.generateBuyPassDecision(faabValue, rosterImpact, sustainability, riskFactors);
    const confidence = this.calculateConfidence(research, recommendation, riskFactors);
    const reasoning = this.generateReasoning(research, faabValue, rosterImpact, sustainability, recommendation);
    const suggestedFAABPercentage = recommendation === 'BUY' ? this.calculateFAABPercentage(faabValue, confidence) : undefined;

    const analysis: PlayerAnalysis = {
      player: research.player,
      recommendation,
      confidence,
      reasoning,
      ...(suggestedFAABPercentage !== undefined && { suggestedFAABPercentage }),
      riskFactors,
      upside
    };

    // Task 6.3: Validation
    if (!NewsAndAnalysisValidator.validatePlayerAnalysis(analysis)) {
      console.warn(`Analysis validation failed for ${research.player.name}, creating fallback`);
      return this.createFallbackAnalysis(research.player);
    }

    console.log(`Analysis complete for ${research.player.name}: ${recommendation} (${confidence}% confidence)`);
    return analysis;
  }

  // Task 6.1: Create player evaluation algorithms

  /**
   * Assess the FAAB value of a player based on multiple factors
   */
  private assessFAABValue(research: PlayerResearch): number {
    let baseValue = 0;

    // Factor 1: Addition frequency (how much other managers want this player)
    const additionScore = Math.min(research.player.additionPercentage / 10, 10); // Max 10 points
    baseValue += additionScore;

    // Factor 2: Recent performance trend
    const performanceScore = this.calculatePerformanceScore(research.recentPerformance);
    baseValue += performanceScore;

    // Factor 3: Opportunity score (injury to starter, role change, etc.)
    const opportunityScore = this.calculateOpportunityScore(research);
    baseValue += opportunityScore;

    // Factor 4: Matchup favorability
    const matchupScore = this.calculateMatchupScore(research.upcomingMatchups);
    baseValue += matchupScore;

    // Factor 5: Position scarcity adjustment
    const scarcityMultiplier = this.getPositionScarcityMultiplier(research.player.position);
    baseValue *= scarcityMultiplier;

    // Normalize to 0-100 scale
    return Math.min(Math.max(Math.round(baseValue), 0), 100);
  }

  private calculatePerformanceScore(performance: PerformanceMetrics): number {
    let score = 0;

    // Base score from recent fantasy points
    const recentAverage = performance.lastThreeWeeks.reduce((sum, week) => sum + week.fantasyPoints, 0) / performance.lastThreeWeeks.length;
    score += Math.min(recentAverage / 2, 15); // Max 15 points

    // Trend bonus/penalty
    switch (performance.trend) {
      case 'improving':
        score += 5;
        break;
      case 'declining':
        score -= 3;
        break;
      case 'stable':
        // No adjustment
        break;
    }

    return Math.max(score, 0);
  }

  private calculateOpportunityScore(research: PlayerResearch): number {
    let score = 0;

    // News sentiment analysis for opportunity indicators
    const positiveNews = research.news.filter(article => article.sentiment === 'positive').length;
    const negativeNews = research.news.filter(article => article.sentiment === 'negative').length;
    
    // Positive news about role expansion, starter injury, etc.
    score += Math.min(positiveNews * 2, 10);
    
    // Check for opportunity keywords in news
    const opportunityKeywords = ['starter', 'promoted', 'increased role', 'more touches', 'rb1', 'wr1', 'te1'];
    const newsText = research.news.map(article => `${article.title} ${article.summary}`).join(' ').toLowerCase();
    
    opportunityKeywords.forEach(keyword => {
      if (newsText.includes(keyword)) {
        score += 3;
      }
    });

    // Injury to competition (negative news about teammates)
    if (negativeNews > 0) {
      score += Math.min(negativeNews * 1.5, 8);
    }

    return Math.min(score, 20);
  }

  private calculateMatchupScore(matchups: Matchup[]): number {
    if (matchups.length === 0) return 0;

    let score = 0;
    matchups.forEach(matchup => {
      switch (matchup.difficulty) {
        case 'easy':
          score += 3;
          break;
        case 'medium':
          score += 1;
          break;
        case 'hard':
          score -= 1;
          break;
      }
    });

    return Math.max(score, 0);
  }

  private getPositionScarcityMultiplier(position: string): number {
    // Position scarcity multipliers based on typical fantasy value
    const multipliers: Record<string, number> = {
      'RB': 1.2,  // RBs are typically more scarce
      'WR': 1.0,  // Baseline
      'TE': 1.1,  // Slightly more scarce than WR
      'QB': 0.8,  // Usually more available
      'K': 0.5,   // Least valuable
      'DST': 0.6  // Low value
    };

    return multipliers[position] || 1.0;
  }

  /**
   * Assess the roster impact and sustainability of adding this player
   */
  private assessRosterImpact(research: PlayerResearch): number {
    let impact = 0;

    // Immediate impact based on recent performance
    const recentPoints = research.recentPerformance.lastThreeWeeks.reduce((sum, week) => sum + week.fantasyPoints, 0) / research.recentPerformance.lastThreeWeeks.length;
    impact += Math.min(recentPoints / 3, 20); // Max 20 points

    // Usage trends (targets, carries, snap count)
    const usageScore = this.calculateUsageScore(research.stats);
    impact += usageScore;

    // Team context and role clarity
    const roleScore = this.calculateRoleScore(research);
    impact += roleScore;

    return Math.min(Math.max(Math.round(impact), 0), 100);
  }

  private calculateUsageScore(stats: PlayerStats): number {
    let score = 0;

    // High usage indicators
    if (stats.usage.snapCount && stats.usage.snapCount > 50) {
      score += 10;
    }
    if (stats.usage.targets && stats.usage.targets > 5) {
      score += 8;
    }
    if (stats.usage.carries && stats.usage.carries > 10) {
      score += 8;
    }
    if (stats.usage.redZoneTargets && stats.usage.redZoneTargets > 2) {
      score += 5;
    }

    return Math.min(score, 25);
  }

  private calculateRoleScore(research: PlayerResearch): number {
    let score = 0;

    // Look for role clarity in news
    const newsText = research.news.map(article => `${article.title} ${article.summary}`).join(' ').toLowerCase();
    
    const positiveRoleKeywords = ['starting', 'featured', 'primary', 'lead back', 'wr1', 'te1'];
    const negativeRoleKeywords = ['backup', 'committee', 'timeshare', 'limited'];

    positiveRoleKeywords.forEach(keyword => {
      if (newsText.includes(keyword)) {
        score += 3;
      }
    });

    negativeRoleKeywords.forEach(keyword => {
      if (newsText.includes(keyword)) {
        score -= 2;
      }
    });

    return Math.max(score, 0);
  }

  /**
   * Assess the sustainability of the player's production
   */
  private assessSustainability(research: PlayerResearch): number {
    let sustainability = 50; // Start at neutral

    // Injury concerns
    const injuryPenalty = this.calculateInjuryPenalty(research.injuryStatus);
    sustainability -= injuryPenalty;

    // Performance consistency
    const consistencyScore = this.calculateConsistencyScore(research.recentPerformance);
    sustainability += consistencyScore;

    // Schedule difficulty
    const scheduleDifficulty = this.calculateScheduleDifficulty(research.upcomingMatchups);
    sustainability -= scheduleDifficulty;

    // Age/experience factors (simplified)
    const experienceScore = this.calculateExperienceScore(research);
    sustainability += experienceScore;

    return Math.min(Math.max(Math.round(sustainability), 0), 100);
  }

  private calculateInjuryPenalty(injury: InjuryReport): number {
    const penalties: Record<InjuryReport['status'], number> = {
      'healthy': 0,
      'questionable': 5,
      'doubtful': 15,
      'out': 25,
      'ir': 50
    };

    let penalty = penalties[injury.status] || 0;

    // Additional penalty based on impact level
    switch (injury.impactLevel) {
      case 'high':
        penalty += 10;
        break;
      case 'medium':
        penalty += 5;
        break;
      case 'low':
        // No additional penalty
        break;
    }

    return penalty;
  }

  private calculateConsistencyScore(performance: PerformanceMetrics): number {
    if (performance.lastThreeWeeks.length < 2) return 0;

    const points = performance.lastThreeWeeks.map(week => week.fantasyPoints);
    const average = points.reduce((sum, p) => sum + p, 0) / points.length;
    
    // Calculate standard deviation
    const variance = points.reduce((sum, p) => sum + Math.pow(p - average, 2), 0) / points.length;
    const stdDev = Math.sqrt(variance);

    // Lower standard deviation = higher consistency = positive score
    const consistencyScore = Math.max(10 - stdDev, -10);
    return Math.round(consistencyScore);
  }

  private calculateScheduleDifficulty(matchups: Matchup[]): number {
    if (matchups.length === 0) return 0;

    let difficulty = 0;
    matchups.forEach(matchup => {
      switch (matchup.difficulty) {
        case 'hard':
          difficulty += 5;
          break;
        case 'medium':
          difficulty += 2;
          break;
        case 'easy':
          difficulty += 0;
          break;
      }
    });

    return Math.round(difficulty / matchups.length);
  }

  private calculateExperienceScore(research: PlayerResearch): number {
    // Simplified experience scoring based on news mentions
    const newsText = research.news.map(article => `${article.title} ${article.summary}`).join(' ').toLowerCase();
    
    if (newsText.includes('rookie') || newsText.includes('first year')) {
      return -5; // Rookies are less predictable
    }
    if (newsText.includes('veteran') || newsText.includes('experienced')) {
      return 5; // Veterans are more reliable
    }
    
    return 0; // Neutral if no clear indicators
  }

  /**
   * Identify risk factors for the player
   */
  private identifyRiskFactors(research: PlayerResearch): string[] {
    const risks: string[] = [];

    // Injury risks
    if (research.injuryStatus.status !== 'healthy') {
      risks.push(`Currently ${research.injuryStatus.status}${research.injuryStatus.description ? ': ' + research.injuryStatus.description : ''}`);
    }

    // Performance risks
    if (research.recentPerformance.trend === 'declining') {
      risks.push('Declining performance trend over recent weeks');
    }

    // Usage concerns
    if (research.stats.usage.snapCount && research.stats.usage.snapCount < 30) {
      risks.push('Limited snap count indicates reduced role');
    }

    // Schedule risks
    const hardMatchups = research.upcomingMatchups.filter(m => m.difficulty === 'hard').length;
    if (hardMatchups >= 2) {
      risks.push(`Difficult upcoming schedule (${hardMatchups} tough matchups)`);
    }

    // News-based risks
    const negativeNews = research.news.filter(article => article.sentiment === 'negative');
    if (negativeNews.length > 0) {
      const riskKeywords = ['injury', 'benched', 'demoted', 'committee', 'limited'];
      negativeNews.forEach(article => {
        const text = `${article.title} ${article.summary}`.toLowerCase();
        riskKeywords.forEach(keyword => {
          if (text.includes(keyword)) {
            risks.push(`Recent news indicates ${keyword} concerns`);
          }
        });
      });
    }

    // Low addition percentage risk
    if (research.player.additionPercentage < 5) {
      risks.push('Low manager interest suggests limited upside');
    }

    return [...new Set(risks)]; // Remove duplicates
  }

  /**
   * Identify upside potential for the player
   */
  private identifyUpside(research: PlayerResearch): string[] {
    const upside: string[] = [];

    // Performance upside
    if (research.recentPerformance.trend === 'improving') {
      upside.push('Improving performance trend suggests continued growth');
    }

    // Usage upside
    if (research.stats.usage.snapCount && research.stats.usage.snapCount > 60) {
      upside.push('High snap count indicates significant role in offense');
    }

    if (research.stats.usage.redZoneTargets && research.stats.usage.redZoneTargets > 2) {
      upside.push('Red zone usage provides touchdown upside');
    }

    // Schedule upside
    const easyMatchups = research.upcomingMatchups.filter(m => m.difficulty === 'easy').length;
    if (easyMatchups >= 2) {
      upside.push(`Favorable upcoming schedule (${easyMatchups} easy matchups)`);
    }

    // News-based upside
    const positiveNews = research.news.filter(article => article.sentiment === 'positive');
    if (positiveNews.length > 0) {
      const upsideKeywords = ['breakout', 'opportunity', 'starter', 'featured', 'increased role'];
      positiveNews.forEach(article => {
        const text = `${article.title} ${article.summary}`.toLowerCase();
        upsideKeywords.forEach(keyword => {
          if (text.includes(keyword)) {
            upside.push(`Recent news suggests ${keyword} potential`);
          }
        });
      });
    }

    // High manager interest
    if (research.player.additionPercentage > 20) {
      upside.push('High manager interest indicates strong perceived value');
    }

    // Efficiency upside
    if (research.stats.efficiency.yardsPerTarget && research.stats.efficiency.yardsPerTarget > 10) {
      upside.push('High yards per target efficiency shows big-play ability');
    }

    if (research.stats.efficiency.yardsPerCarry && research.stats.efficiency.yardsPerCarry > 4.5) {
      upside.push('Strong yards per carry efficiency indicates effective runner');
    }

    return [...new Set(upside)]; // Remove duplicates
  }

  // Task 6.2: Implement recommendation generation

  /**
   * Generate buy/pass decision with confidence scoring
   */
  private generateBuyPassDecision(
    faabValue: number, 
    rosterImpact: number, 
    sustainability: number, 
    riskFactors: string[]
  ): 'BUY' | 'PASS' {
    // Calculate composite score
    const compositeScore = (faabValue * 0.4) + (rosterImpact * 0.35) + (sustainability * 0.25);
    
    // Risk adjustment
    const riskPenalty = Math.min(riskFactors.length * 5, 20);
    const adjustedScore = compositeScore - riskPenalty;

    // Decision thresholds
    const buyThreshold = 60;
    
    return adjustedScore >= buyThreshold ? 'BUY' : 'PASS';
  }

  /**
   * Calculate confidence score for the recommendation
   */
  private calculateConfidence(
    research: PlayerResearch, 
    recommendation: 'BUY' | 'PASS', 
    riskFactors: string[]
  ): number {
    let confidence = 50; // Base confidence

    // Data quality factors
    const newsCount = research.news.length;
    if (newsCount >= 3) {
      confidence += 15; // Good news coverage
    } else if (newsCount === 0) {
      confidence -= 20; // No news coverage
    }

    // Performance data quality
    if (research.recentPerformance.lastThreeWeeks.length >= 3) {
      confidence += 10; // Full recent data
    }

    // Injury status clarity
    if (research.injuryStatus.status === 'healthy') {
      confidence += 10;
    } else if (research.injuryStatus.status === 'out' || research.injuryStatus.status === 'ir') {
      confidence += 5; // Clear status, even if negative
    } else {
      confidence -= 10; // Uncertain injury status
    }

    // Manager consensus (addition percentage)
    if (research.player.additionPercentage > 30) {
      confidence += 15; // Strong consensus
    } else if (research.player.additionPercentage < 5) {
      confidence -= 10; // Weak consensus
    }

    // Risk factor penalty
    confidence -= Math.min(riskFactors.length * 3, 15);

    // Recommendation-specific adjustments
    if (recommendation === 'BUY') {
      // Higher bar for buy recommendations
      if (research.recentPerformance.trend === 'improving') {
        confidence += 10;
      }
      if (research.stats.fantasyPoints > 10) {
        confidence += 5;
      }
    } else {
      // Pass recommendations get confidence boost if clear negatives
      if (riskFactors.length >= 3) {
        confidence += 10;
      }
    }

    return Math.min(Math.max(Math.round(confidence), 0), 100);
  }

  /**
   * Generate detailed reasoning for the recommendation
   */
  private generateReasoning(
    research: PlayerResearch,
    faabValue: number,
    rosterImpact: number,
    sustainability: number,
    recommendation: 'BUY' | 'PASS'
  ): string[] {
    const reasoning: string[] = [];

    // Primary reasoning based on recommendation
    if (recommendation === 'BUY') {
      reasoning.push(`Strong overall value score (FAAB: ${faabValue}, Impact: ${rosterImpact}, Sustainability: ${sustainability})`);
      
      // Specific buy reasons
      if (research.player.additionPercentage > 20) {
        reasoning.push(`High manager interest (${research.player.additionPercentage}% of leagues adding)`);
      }
      
      if (research.recentPerformance.trend === 'improving') {
        reasoning.push('Improving performance trend indicates upward trajectory');
      }
      
      if (research.stats.fantasyPoints > 10) {
        reasoning.push(`Solid recent production (${research.stats.fantasyPoints.toFixed(1)} fantasy points)`);
      }
      
      // Opportunity-based reasoning
      const positiveNews = research.news.filter(n => n.sentiment === 'positive');
      if (positiveNews.length > 0) {
        reasoning.push('Positive news coverage suggests favorable situation');
      }
      
    } else {
      reasoning.push(`Below threshold for acquisition (FAAB: ${faabValue}, Impact: ${rosterImpact}, Sustainability: ${sustainability})`);
      
      // Specific pass reasons
      if (research.injuryStatus.status !== 'healthy') {
        reasoning.push(`Injury concerns (${research.injuryStatus.status})`);
      }
      
      if (research.recentPerformance.trend === 'declining') {
        reasoning.push('Declining performance trend raises concerns');
      }
      
      if (research.player.additionPercentage < 10) {
        reasoning.push(`Limited manager interest (${research.player.additionPercentage}% addition rate)`);
      }
      
      if (research.stats.fantasyPoints < 5) {
        reasoning.push(`Low recent production (${research.stats.fantasyPoints.toFixed(1)} fantasy points)`);
      }
    }

    // Usage-based reasoning
    if (research.stats.usage.snapCount) {
      if (research.stats.usage.snapCount > 60) {
        reasoning.push(`High snap count (${research.stats.usage.snapCount}%) indicates significant role`);
      } else if (research.stats.usage.snapCount < 30) {
        reasoning.push(`Limited snap count (${research.stats.usage.snapCount}%) suggests reduced opportunity`);
      }
    }

    // Matchup reasoning
    const easyMatchups = research.upcomingMatchups.filter(m => m.difficulty === 'easy').length;
    const hardMatchups = research.upcomingMatchups.filter(m => m.difficulty === 'hard').length;
    
    if (easyMatchups >= 2) {
      reasoning.push(`Favorable upcoming schedule (${easyMatchups} easy matchups)`);
    } else if (hardMatchups >= 2) {
      reasoning.push(`Challenging upcoming schedule (${hardMatchups} difficult matchups)`);
    }

    // Position-specific reasoning
    if (research.player.position === 'RB' && research.stats.usage.carries && research.stats.usage.carries > 15) {
      reasoning.push('High carry volume provides consistent floor');
    }
    
    if (research.player.position === 'WR' && research.stats.usage.targets && research.stats.usage.targets > 8) {
      reasoning.push('Strong target share indicates quarterback trust');
    }

    // Ensure we have at least 2 reasons
    if (reasoning.length < 2) {
      if (recommendation === 'BUY') {
        reasoning.push('Multiple positive factors align for potential value');
      } else {
        reasoning.push('Risk factors outweigh potential upside');
      }
    }

    return reasoning.slice(0, 5); // Limit to top 5 reasons
  }

  /**
   * Calculate suggested FAAB percentage for BUY recommendations
   */
  private calculateFAABPercentage(faabValue: number, confidence: number): number {
    // Base percentage from FAAB value (0-100 scale to 0-25% FAAB)
    let basePercentage = (faabValue / 100) * 25;
    
    // Confidence adjustment
    const confidenceMultiplier = confidence / 100;
    basePercentage *= confidenceMultiplier;
    
    // Position-based adjustments would go here
    // For now, using a simple scaling
    
    // Round to nearest 0.5%
    const rounded = Math.round(basePercentage * 2) / 2;
    
    // Ensure reasonable bounds (1-30%)
    return Math.min(Math.max(rounded, 1), 30);
  }

  // Task 6.3: Add analysis validation and quality checks

  /**
   * Validate analysis completeness and consistency
   */
  public validateAnalysisQuality(analyses: PlayerAnalysis[]): {
    valid: number;
    invalid: number;
    issues: string[];
    consistencyIssues: string[];
  } {
    let valid = 0;
    let invalid = 0;
    const issues: string[] = [];
    const consistencyIssues: string[] = [];

    // Individual analysis validation
    for (const analysis of analyses) {
      if (NewsAndAnalysisValidator.validatePlayerAnalysis(analysis)) {
        valid++;
      } else {
        invalid++;
        issues.push(`Invalid analysis structure for ${analysis.player.name}`);
      }

      // Content quality checks
      if (analysis.reasoning.length === 0) {
        issues.push(`No reasoning provided for ${analysis.player.name}`);
      }

      if (analysis.recommendation === 'BUY' && !analysis.suggestedFAABPercentage) {
        issues.push(`BUY recommendation missing FAAB percentage for ${analysis.player.name}`);
      }

      if (analysis.confidence < 30) {
        issues.push(`Very low confidence (${analysis.confidence}%) for ${analysis.player.name}`);
      }
    }

    // Cross-analysis consistency checks
    this.performConsistencyChecks(analyses, consistencyIssues);

    return { valid, invalid, issues, consistencyIssues };
  }

  private performConsistencyChecks(analyses: PlayerAnalysis[], issues: string[]): void {
    const buyRecommendations = analyses.filter(a => a.recommendation === 'BUY');
    const passRecommendations = analyses.filter(a => a.recommendation === 'PASS');

    // Check for reasonable distribution
    if (buyRecommendations.length === 0 && analyses.length > 5) {
      issues.push('No BUY recommendations in large player set - may be too conservative');
    }

    if (buyRecommendations.length === analyses.length && analyses.length > 3) {
      issues.push('All BUY recommendations - may be too aggressive');
    }

    // Check confidence consistency
    const avgBuyConfidence = buyRecommendations.length > 0 
      ? buyRecommendations.reduce((sum, a) => sum + a.confidence, 0) / buyRecommendations.length 
      : 0;
    
    const avgPassConfidence = passRecommendations.length > 0
      ? passRecommendations.reduce((sum, a) => sum + a.confidence, 0) / passRecommendations.length
      : 0;

    if (avgBuyConfidence < avgPassConfidence && buyRecommendations.length > 0 && passRecommendations.length > 0) {
      issues.push('BUY recommendations have lower average confidence than PASS - review criteria');
    }

    // Check FAAB percentage distribution
    const faabPercentages = buyRecommendations
      .map(a => a.suggestedFAABPercentage)
      .filter((p): p is number => p !== undefined);

    if (faabPercentages.length > 1) {
      const maxFaab = Math.max(...faabPercentages);
      const minFaab = Math.min(...faabPercentages);
      
      if (maxFaab - minFaab < 2 && faabPercentages.length > 3) {
        issues.push('FAAB percentages too similar - may lack differentiation');
      }
    }
  }

  /**
   * Log analysis decisions and reasoning for monitoring
   */
  public logAnalysisDecisions(analyses: PlayerAnalysis[]): void {
    console.log('\n=== ANALYSIS SUMMARY ===');
    console.log(`Total players analyzed: ${analyses.length}`);
    
    const buyCount = analyses.filter(a => a.recommendation === 'BUY').length;
    const passCount = analyses.filter(a => a.recommendation === 'PASS').length;
    
    console.log(`BUY recommendations: ${buyCount}`);
    console.log(`PASS recommendations: ${passCount}`);
    
    const avgConfidence = analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length;
    console.log(`Average confidence: ${avgConfidence.toFixed(1)}%`);

    // Log top recommendations
    const topBuys = analyses
      .filter(a => a.recommendation === 'BUY')
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);

    if (topBuys.length > 0) {
      console.log('\nTop BUY recommendations:');
      topBuys.forEach((analysis, index) => {
        console.log(`${index + 1}. ${analysis.player.name} (${analysis.confidence}% confidence, ${analysis.suggestedFAABPercentage}% FAAB)`);
        console.log(`   Reason: ${analysis.reasoning[0]}`);
      });
    }

    console.log('=== END ANALYSIS SUMMARY ===\n');
  }

  /**
   * Create fallback analysis for failed cases
   */
  private createFallbackAnalysis(player: PlayerSummary): PlayerAnalysis {
    return {
      player,
      recommendation: 'PASS',
      confidence: 30,
      reasoning: ['Insufficient data for reliable analysis', 'Conservative approach due to analysis failure'],
      riskFactors: ['Limited analysis data available'],
      upside: []
    };
  }

  /**
   * Get analysis statistics for monitoring
   */
  public getAnalysisStats(analyses: PlayerAnalysis[]) {
    const stats = {
      totalAnalyzed: analyses.length,
      buyRecommendations: analyses.filter(a => a.recommendation === 'BUY').length,
      passRecommendations: analyses.filter(a => a.recommendation === 'PASS').length,
      averageConfidence: analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length,
      highConfidenceCount: analyses.filter(a => a.confidence >= 80).length,
      lowConfidenceCount: analyses.filter(a => a.confidence < 50).length,
      averageFAAB: 0,
      positionBreakdown: {} as Record<string, { buy: number; pass: number }>
    };

    // Calculate average FAAB for BUY recommendations
    const faabValues = analyses
      .filter(a => a.recommendation === 'BUY' && a.suggestedFAABPercentage)
      .map(a => a.suggestedFAABPercentage!);
    
    if (faabValues.length > 0) {
      stats.averageFAAB = faabValues.reduce((sum, faab) => sum + faab, 0) / faabValues.length;
    }

    // Position breakdown
    analyses.forEach(analysis => {
      const pos = analysis.player.position;
      if (!stats.positionBreakdown[pos]) {
        stats.positionBreakdown[pos] = { buy: 0, pass: 0 };
      }
      
      if (analysis.recommendation === 'BUY') {
        stats.positionBreakdown[pos].buy++;
      } else {
        stats.positionBreakdown[pos].pass++;
      }
    });

    return stats;
  }
}