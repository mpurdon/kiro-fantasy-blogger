// Player-related data models and interfaces

export interface Player {
  id: string;
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST';
  team: string;
  jerseyNumber?: number;
}

export interface PlayerSummary {
  playerId: string;
  name: string;
  position: string;
  team: string;
  additionCount: number;
  additionPercentage: number;
  platforms: string[];
}

export interface PlayerStats {
  season: number;
  week: number;
  fantasyPoints: number;
  projectedPoints: number;
  usage: {
    snapCount?: number;
    targets?: number;
    carries?: number;
    redZoneTargets?: number;
  };
  efficiency: {
    yardsPerTarget?: number;
    yardsPerCarry?: number;
    touchdownRate?: number;
  };
}

export interface PlayerAdditionData {
  playerId: string;
  name: string;
  position: string;
  team: string;
  additionCount: number;
  platform: string;
  timestamp: Date;
}

export interface NewsArticle {
  title: string;
  source: string;
  publishDate: Date;
  summary: string;
  url: string;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface InjuryReport {
  status: 'healthy' | 'questionable' | 'doubtful' | 'out' | 'ir';
  description?: string;
  expectedReturn?: Date;
  impactLevel: 'low' | 'medium' | 'high';
}

export interface Matchup {
  opponent: string;
  isHome: boolean;
  gameDate: Date;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface PerformanceMetrics {
  lastThreeWeeks: PlayerStats[];
  seasonAverage: PlayerStats;
  trend: 'improving' | 'declining' | 'stable';
}

export interface PlayerResearch {
  player: PlayerSummary;
  news: NewsArticle[];
  stats: PlayerStats;
  injuryStatus: InjuryReport;
  upcomingMatchups: Matchup[];
  recentPerformance: PerformanceMetrics;
}

export interface PlayerAnalysis {
  player: PlayerSummary;
  recommendation: 'BUY' | 'PASS';
  confidence: number;
  reasoning: string[];
  suggestedFAABPercentage?: number;
  riskFactors: string[];
  upside: string[];
}

// Validation functions for player data integrity
export class PlayerValidator {
  static validatePlayer(player: Player): boolean {
    if (!player.id || typeof player.id !== 'string' || player.id.trim() === '') {
      return false;
    }
    
    if (!player.name || typeof player.name !== 'string' || player.name.trim() === '') {
      return false;
    }
    
    const validPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];
    if (!validPositions.includes(player.position)) {
      return false;
    }
    
    if (!player.team || typeof player.team !== 'string' || player.team.trim() === '') {
      return false;
    }
    
    if (player.jerseyNumber !== undefined && 
        (typeof player.jerseyNumber !== 'number' || player.jerseyNumber < 0 || player.jerseyNumber > 99)) {
      return false;
    }
    
    return true;
  }

  static validatePlayerSummary(summary: PlayerSummary): boolean {
    if (!summary.playerId || typeof summary.playerId !== 'string' || summary.playerId.trim() === '') {
      return false;
    }
    
    if (!summary.name || typeof summary.name !== 'string' || summary.name.trim() === '') {
      return false;
    }
    
    if (!summary.position || typeof summary.position !== 'string' || summary.position.trim() === '') {
      return false;
    }
    
    if (!summary.team || typeof summary.team !== 'string' || summary.team.trim() === '') {
      return false;
    }
    
    if (typeof summary.additionCount !== 'number' || summary.additionCount < 0) {
      return false;
    }
    
    if (typeof summary.additionPercentage !== 'number' || 
        summary.additionPercentage < 0 || summary.additionPercentage > 100) {
      return false;
    }
    
    if (!Array.isArray(summary.platforms) || summary.platforms.length === 0) {
      return false;
    }
    
    return true;
  }

  static validatePlayerStats(stats: PlayerStats): boolean {
    if (typeof stats.season !== 'number' || stats.season < 2020 || stats.season > 2030) {
      return false;
    }
    
    if (typeof stats.week !== 'number' || stats.week < 1 || stats.week > 18) {
      return false;
    }
    
    if (typeof stats.fantasyPoints !== 'number' || stats.fantasyPoints < 0) {
      return false;
    }
    
    if (typeof stats.projectedPoints !== 'number' || stats.projectedPoints < 0) {
      return false;
    }
    
    // Validate usage stats if provided
    if (stats.usage.snapCount !== undefined && 
        (typeof stats.usage.snapCount !== 'number' || stats.usage.snapCount < 0)) {
      return false;
    }
    
    if (stats.usage.targets !== undefined && 
        (typeof stats.usage.targets !== 'number' || stats.usage.targets < 0)) {
      return false;
    }
    
    if (stats.usage.carries !== undefined && 
        (typeof stats.usage.carries !== 'number' || stats.usage.carries < 0)) {
      return false;
    }
    
    // Validate efficiency stats if provided
    if (stats.efficiency.yardsPerTarget !== undefined && 
        (typeof stats.efficiency.yardsPerTarget !== 'number' || stats.efficiency.yardsPerTarget < 0)) {
      return false;
    }
    
    if (stats.efficiency.yardsPerCarry !== undefined && 
        (typeof stats.efficiency.yardsPerCarry !== 'number' || stats.efficiency.yardsPerCarry < 0)) {
      return false;
    }
    
    return true;
  }
}

// Utility functions for data transformation
export class PlayerDataTransformer {
  static playerAdditionDataToSummary(additionData: PlayerAdditionData[]): PlayerSummary[] {
    const playerMap = new Map<string, PlayerSummary>();
    
    additionData.forEach(data => {
      const existing = playerMap.get(data.playerId);
      
      if (existing) {
        existing.additionCount += data.additionCount;
        existing.platforms.push(data.platform);
      } else {
        playerMap.set(data.playerId, {
          playerId: data.playerId,
          name: data.name,
          position: data.position,
          team: data.team,
          additionCount: data.additionCount,
          additionPercentage: 0, // Will be calculated later
          platforms: [data.platform]
        });
      }
    });
    
    return Array.from(playerMap.values());
  }

  static calculateAdditionPercentages(summaries: PlayerSummary[], totalLeagues: number): PlayerSummary[] {
    return summaries.map(summary => ({
      ...summary,
      additionPercentage: Math.round((summary.additionCount / totalLeagues) * 100 * 100) / 100
    }));
  }

  static sortByAdditionCount(summaries: PlayerSummary[]): PlayerSummary[] {
    return [...summaries].sort((a, b) => b.additionCount - a.additionCount);
  }

  static filterTopN(summaries: PlayerSummary[], n: number): PlayerSummary[] {
    return summaries.slice(0, n);
  }

  static normalizePlayerName(name: string): string {
    return name.trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s.-]/g, '')
      .toLowerCase();
  }

  static normalizeTeamName(team: string): string {
    const teamMappings: Record<string, string> = {
      'arizona cardinals': 'ARI',
      'atlanta falcons': 'ATL',
      'baltimore ravens': 'BAL',
      'buffalo bills': 'BUF',
      'carolina panthers': 'CAR',
      'chicago bears': 'CHI',
      'cincinnati bengals': 'CIN',
      'cleveland browns': 'CLE',
      'dallas cowboys': 'DAL',
      'denver broncos': 'DEN',
      'detroit lions': 'DET',
      'green bay packers': 'GB',
      'houston texans': 'HOU',
      'indianapolis colts': 'IND',
      'jacksonville jaguars': 'JAX',
      'kansas city chiefs': 'KC',
      'las vegas raiders': 'LV',
      'los angeles chargers': 'LAC',
      'los angeles rams': 'LAR',
      'miami dolphins': 'MIA',
      'minnesota vikings': 'MIN',
      'new england patriots': 'NE',
      'new orleans saints': 'NO',
      'new york giants': 'NYG',
      'new york jets': 'NYJ',
      'philadelphia eagles': 'PHI',
      'pittsburgh steelers': 'PIT',
      'san francisco 49ers': 'SF',
      'seattle seahawks': 'SEA',
      'tampa bay buccaneers': 'TB',
      'tennessee titans': 'TEN',
      'washington commanders': 'WAS'
    };
    
    const normalized = team.toLowerCase().trim();
    return teamMappings[normalized] || team.toUpperCase();
  }

  static mergePlayerStats(stats: PlayerStats[]): PlayerStats {
    if (stats.length === 0) {
      throw new Error('Cannot merge empty stats array');
    }
    
    if (stats.length === 1) {
      return stats[0]!;
    }
    
    const totalFantasyPoints = stats.reduce((sum, stat) => sum + stat.fantasyPoints, 0);
    const totalProjectedPoints = stats.reduce((sum, stat) => sum + stat.projectedPoints, 0);
    
    // Calculate averages for usage stats
    const totalSnapCount = stats.reduce((sum, stat) => sum + (stat.usage.snapCount || 0), 0);
    const totalTargets = stats.reduce((sum, stat) => sum + (stat.usage.targets || 0), 0);
    const totalCarries = stats.reduce((sum, stat) => sum + (stat.usage.carries || 0), 0);
    const totalRedZoneTargets = stats.reduce((sum, stat) => sum + (stat.usage.redZoneTargets || 0), 0);
    
    return {
      season: stats[0]!.season,
      week: stats[stats.length - 1]!.week, // Use latest week
      fantasyPoints: Math.round(totalFantasyPoints / stats.length * 100) / 100,
      projectedPoints: Math.round(totalProjectedPoints / stats.length * 100) / 100,
      usage: {
        ...(totalSnapCount > 0 && { snapCount: Math.round(totalSnapCount / stats.length) }),
        ...(totalTargets > 0 && { targets: Math.round(totalTargets / stats.length) }),
        ...(totalCarries > 0 && { carries: Math.round(totalCarries / stats.length) }),
        ...(totalRedZoneTargets > 0 && { redZoneTargets: Math.round(totalRedZoneTargets / stats.length) })
      },
      efficiency: (() => {
        const efficiency: PlayerStats['efficiency'] = {};
        const yardsPerTarget = this.calculateAverageEfficiency(stats, 'yardsPerTarget');
        const yardsPerCarry = this.calculateAverageEfficiency(stats, 'yardsPerCarry');
        const touchdownRate = this.calculateAverageEfficiency(stats, 'touchdownRate');
        
        if (yardsPerTarget !== undefined) efficiency.yardsPerTarget = yardsPerTarget;
        if (yardsPerCarry !== undefined) efficiency.yardsPerCarry = yardsPerCarry;
        if (touchdownRate !== undefined) efficiency.touchdownRate = touchdownRate;
        
        return efficiency;
      })()
    };
  }

  private static calculateAverageEfficiency(
    stats: PlayerStats[], 
    field: keyof PlayerStats['efficiency']
  ): number | undefined {
    const validStats = stats.filter(stat => stat.efficiency[field] !== undefined);
    if (validStats.length === 0) return undefined;
    
    const sum = validStats.reduce((acc, stat) => acc + (stat.efficiency[field] || 0), 0);
    return Math.round(sum / validStats.length * 100) / 100;
  }
}

// Validation functions for news and analysis data
export class NewsAndAnalysisValidator {
  static validateNewsArticle(article: NewsArticle): boolean {
    if (!article.title || typeof article.title !== 'string' || article.title.trim() === '') {
      return false;
    }
    
    if (!article.source || typeof article.source !== 'string' || article.source.trim() === '') {
      return false;
    }
    
    if (!(article.publishDate instanceof Date) || isNaN(article.publishDate.getTime())) {
      return false;
    }
    
    if (!article.summary || typeof article.summary !== 'string' || article.summary.trim() === '') {
      return false;
    }
    
    if (!article.url || typeof article.url !== 'string' || !this.isValidUrl(article.url)) {
      return false;
    }
    
    const validSentiments = ['positive', 'neutral', 'negative'];
    if (!validSentiments.includes(article.sentiment)) {
      return false;
    }
    
    return true;
  }

  static validateInjuryReport(report: InjuryReport): boolean {
    const validStatuses = ['healthy', 'questionable', 'doubtful', 'out', 'ir'];
    if (!validStatuses.includes(report.status)) {
      return false;
    }
    
    if (report.description !== undefined && 
        (typeof report.description !== 'string' || report.description.trim() === '')) {
      return false;
    }
    
    if (report.expectedReturn !== undefined && 
        (!(report.expectedReturn instanceof Date) || isNaN(report.expectedReturn.getTime()))) {
      return false;
    }
    
    const validImpactLevels = ['low', 'medium', 'high'];
    if (!validImpactLevels.includes(report.impactLevel)) {
      return false;
    }
    
    return true;
  }

  static validatePlayerAnalysis(analysis: PlayerAnalysis): boolean {
    if (!PlayerValidator.validatePlayerSummary(analysis.player)) {
      return false;
    }
    
    const validRecommendations = ['BUY', 'PASS'];
    if (!validRecommendations.includes(analysis.recommendation)) {
      return false;
    }
    
    if (typeof analysis.confidence !== 'number' || 
        analysis.confidence < 0 || analysis.confidence > 100) {
      return false;
    }
    
    if (!Array.isArray(analysis.reasoning) || analysis.reasoning.length === 0) {
      return false;
    }
    
    if (!analysis.reasoning.every(reason => typeof reason === 'string' && reason.trim() !== '')) {
      return false;
    }
    
    if (analysis.suggestedFAABPercentage !== undefined && 
        (typeof analysis.suggestedFAABPercentage !== 'number' || 
         analysis.suggestedFAABPercentage < 0 || analysis.suggestedFAABPercentage > 100)) {
      return false;
    }
    
    if (!Array.isArray(analysis.riskFactors)) {
      return false;
    }
    
    if (!analysis.riskFactors.every(factor => typeof factor === 'string' && factor.trim() !== '')) {
      return false;
    }
    
    if (!Array.isArray(analysis.upside)) {
      return false;
    }
    
    if (!analysis.upside.every(point => typeof point === 'string' && point.trim() !== '')) {
      return false;
    }
    
    return true;
  }

  static validateMatchup(matchup: Matchup): boolean {
    if (!matchup.opponent || typeof matchup.opponent !== 'string' || matchup.opponent.trim() === '') {
      return false;
    }
    
    if (typeof matchup.isHome !== 'boolean') {
      return false;
    }
    
    if (!(matchup.gameDate instanceof Date) || isNaN(matchup.gameDate.getTime())) {
      return false;
    }
    
    const validDifficulties = ['easy', 'medium', 'hard'];
    if (!validDifficulties.includes(matchup.difficulty)) {
      return false;
    }
    
    return true;
  }

  static validatePerformanceMetrics(metrics: PerformanceMetrics): boolean {
    if (!Array.isArray(metrics.lastThreeWeeks) || metrics.lastThreeWeeks.length === 0) {
      return false;
    }
    
    if (!metrics.lastThreeWeeks.every(stat => PlayerValidator.validatePlayerStats(stat))) {
      return false;
    }
    
    if (!PlayerValidator.validatePlayerStats(metrics.seasonAverage)) {
      return false;
    }
    
    const validTrends = ['improving', 'declining', 'stable'];
    if (!validTrends.includes(metrics.trend)) {
      return false;
    }
    
    return true;
  }

  static validatePlayerResearch(research: PlayerResearch): boolean {
    if (!PlayerValidator.validatePlayerSummary(research.player)) {
      return false;
    }
    
    if (!Array.isArray(research.news)) {
      return false;
    }
    
    if (!research.news.every(article => this.validateNewsArticle(article))) {
      return false;
    }
    
    if (!PlayerValidator.validatePlayerStats(research.stats)) {
      return false;
    }
    
    if (!this.validateInjuryReport(research.injuryStatus)) {
      return false;
    }
    
    if (!Array.isArray(research.upcomingMatchups)) {
      return false;
    }
    
    if (!research.upcomingMatchups.every(matchup => this.validateMatchup(matchup))) {
      return false;
    }
    
    if (!this.validatePerformanceMetrics(research.recentPerformance)) {
      return false;
    }
    
    return true;
  }

  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

// Utility functions for news and analysis data transformation
export class NewsAndAnalysisTransformer {
  static filterRecentNews(articles: NewsArticle[], daysBack: number = 7): NewsArticle[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    
    return articles.filter(article => article.publishDate >= cutoffDate);
  }

  static sortNewsByDate(articles: NewsArticle[], ascending: boolean = false): NewsArticle[] {
    return [...articles].sort((a, b) => {
      const comparison = a.publishDate.getTime() - b.publishDate.getTime();
      return ascending ? comparison : -comparison;
    });
  }

  static categorizeNewsBySentiment(articles: NewsArticle[]): {
    positive: NewsArticle[];
    neutral: NewsArticle[];
    negative: NewsArticle[];
  } {
    return {
      positive: articles.filter(article => article.sentiment === 'positive'),
      neutral: articles.filter(article => article.sentiment === 'neutral'),
      negative: articles.filter(article => article.sentiment === 'negative')
    };
  }

  static calculateSentimentScore(articles: NewsArticle[]): number {
    if (articles.length === 0) return 0;
    
    const sentimentValues = {
      positive: 1,
      neutral: 0,
      negative: -1
    };
    
    const totalScore = articles.reduce((sum, article) => {
      return sum + sentimentValues[article.sentiment];
    }, 0);
    
    return Math.round((totalScore / articles.length) * 100) / 100;
  }

  static summarizeInjuryImpact(report: InjuryReport): string {
    const statusDescriptions = {
      healthy: 'No injury concerns',
      questionable: 'Limited practice, game-time decision',
      doubtful: 'Unlikely to play',
      out: 'Will not play',
      ir: 'On injured reserve, out for extended period'
    };
    
    let summary = statusDescriptions[report.status];
    
    if (report.description) {
      summary += ` - ${report.description}`;
    }
    
    if (report.expectedReturn && report.status !== 'healthy') {
      const returnDate = report.expectedReturn.toLocaleDateString();
      summary += ` (Expected return: ${returnDate})`;
    }
    
    return summary;
  }

  static generateAnalysisSummary(analysis: PlayerAnalysis): string {
    const recommendation = analysis.recommendation;
    const confidence = analysis.confidence;
    const faabPercentage = analysis.suggestedFAABPercentage;
    
    let summary = `${recommendation} recommendation with ${confidence}% confidence`;
    
    if (faabPercentage && recommendation === 'BUY') {
      summary += ` - Suggested FAAB: ${faabPercentage}%`;
    }
    
    if (analysis.reasoning.length > 0) {
      summary += ` - Key reason: ${analysis.reasoning[0]}`;
    }
    
    return summary;
  }

  static rankAnalysesByConfidence(analyses: PlayerAnalysis[]): PlayerAnalysis[] {
    return [...analyses].sort((a, b) => b.confidence - a.confidence);
  }

  static filterAnalysesByRecommendation(
    analyses: PlayerAnalysis[], 
    recommendation: 'BUY' | 'PASS'
  ): PlayerAnalysis[] {
    return analyses.filter(analysis => analysis.recommendation === recommendation);
  }

  static calculateAverageConfidence(analyses: PlayerAnalysis[]): number {
    if (analyses.length === 0) return 0;
    
    const totalConfidence = analyses.reduce((sum, analysis) => sum + analysis.confidence, 0);
    return Math.round((totalConfidence / analyses.length) * 100) / 100;
  }
}