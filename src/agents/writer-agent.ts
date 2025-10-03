// Writer Agent implementation for creating blog posts from player analysis

import { BaseAgent, WriterAgent as IWriterAgent } from './interfaces';
import { 
  PlayerAnalysis, 
  BlogPost, 
  BlogMetadata
} from '../models';
import { BlogValidator, BlogTransformer } from '../models/blog';

export class WriterAgent implements BaseAgent, IWriterAgent {
  public readonly name = 'WriterAgent';
  private initialized = false;

  constructor() {}

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('Initializing Writer Agent...');
    this.initialized = true;
    console.log('Writer Agent initialized successfully');
  }

  public async execute(input: PlayerAnalysis[]): Promise<BlogPost> {
    if (!this.initialized) {
      await this.initialize();
    }

    console.log(`Creating blog post from ${input.length} player analyses...`);
    
    try {
      const blogPost = await this.createBlogPost(input);
      console.log(`Blog post created successfully: "${blogPost.title}"`);
      return blogPost;
    } catch (error) {
      console.error('Failed to create blog post:', error);
      throw error;
    }
  }

  public async cleanup(): Promise<void> {
    console.log('Writer Agent cleanup completed');
  }

  // Task 7.1: Create blog post structure generation

  public async createBlogPost(analyses: PlayerAnalysis[]): Promise<BlogPost> {
    console.log('Generating blog post structure...');

    // Validate input
    if (!analyses || analyses.length === 0) {
      throw new Error('Cannot create blog post with empty analyses array');
    }

    // Generate title and summary
    const title = this.generateEngagingTitle(analyses);
    const summary = this.generateSummary(analyses);

    // Create blog post outline and sections
    const content = this.createBlogPostContent(analyses);

    // Generate metadata and SEO optimization (Task 7.3)
    const metadata = this.generateBlogMetadata(analyses, title, summary);

    const blogPost: BlogPost = {
      title,
      summary,
      content,
      metadata,
      publishDate: new Date()
    };

    // Validate the blog post
    if (!BlogValidator.validateBlogPost(blogPost)) {
      throw new Error('Generated blog post failed validation');
    }

    return blogPost;
  }

  /**
   * Generate engaging headlines and introduction text
   */
  private generateEngagingTitle(analyses: PlayerAnalysis[]): string {
    const buyCount = analyses.filter(a => a.recommendation === 'BUY').length;
    const totalCount = analyses.length;
    
    // Get current week (simplified - would normally get from system)
    const currentWeek = this.getCurrentWeek();
    
    const titleTemplates = [
      `Week ${currentWeek} FAAB Targets: ${buyCount} Players Worth Your Budget`,
      `Fantasy Football Week ${currentWeek}: Top ${totalCount} Waiver Wire Adds Analyzed`,
      `FAAB Breakdown Week ${currentWeek}: ${buyCount} Buys, ${totalCount - buyCount} Passes`,
      `Week ${currentWeek} Waiver Wire: ${buyCount} Players to Target This Week`,
      `Fantasy FAAB Guide Week ${currentWeek}: ${totalCount} Most Added Players Analyzed`
    ];

    // Select title based on buy/pass ratio
    let selectedTitle: string;
    if (buyCount === 0) {
      selectedTitle = `Week ${currentWeek} FAAB Alert: Why You Should Pass on This Week's Popular Adds`;
    } else if (buyCount === totalCount) {
      selectedTitle = `Week ${currentWeek} FAAB Bonanza: ${buyCount} Must-Add Players This Week`;
    } else {
      selectedTitle = titleTemplates[Math.floor(Math.random() * titleTemplates.length)]!;
    }

    return BlogTransformer.sanitizeTitle(selectedTitle);
  }

  /**
   * Generate player ranking and summary
   */
  private generateSummary(analyses: PlayerAnalysis[]): string {
    const buyCount = analyses.filter(a => a.recommendation === 'BUY').length;
    const passCount = analyses.filter(a => a.recommendation === 'PASS').length;
    const avgConfidence = Math.round(analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length);

    const topBuy = analyses
      .filter(a => a.recommendation === 'BUY')
      .sort((a, b) => b.confidence - a.confidence)[0];

    let summary = `This week's FAAB analysis covers ${analyses.length} of the most added players across fantasy football platforms. `;
    
    if (buyCount > 0) {
      summary += `Our analysis recommends targeting ${buyCount} player${buyCount > 1 ? 's' : ''} `;
      if (topBuy) {
        summary += `with ${topBuy.player.name} leading our buy recommendations. `;
      }
    } else {
      summary += `However, we recommend passing on all ${analyses.length} players this week due to various risk factors. `;
    }

    if (passCount > 0 && buyCount > 0) {
      summary += `We suggest avoiding ${passCount} player${passCount > 1 ? 's' : ''} despite their popularity. `;
    }

    summary += `Analysis confidence averages ${avgConfidence}% across all recommendations.`;

    return BlogTransformer.truncateSummary(summary);
  }

  /**
   * Create blog post outline and sections
   */
  private createBlogPostContent(analyses: PlayerAnalysis[]): string {
    let content = '';

    // Introduction section
    content += this.createIntroductionSection(analyses);
    content += '\n\n';

    // Executive Summary section
    content += this.createExecutiveSummarySection(analyses);
    content += '\n\n';

    // Player Analysis sections
    content += this.createPlayerAnalysisSections(analyses);
    content += '\n\n';

    // Conclusion section
    content += this.createConclusionSection(analyses);

    return content;
  }

  private createIntroductionSection(analyses: PlayerAnalysis[]): string {
    const currentWeek = this.getCurrentWeek();
    
    let intro = `# Week ${currentWeek} FAAB Analysis: Most Added Players\n\n`;
    
    intro += `Welcome to this week's comprehensive FAAB (Free Agent Acquisition Budget) analysis. `;
    intro += `We've analyzed the ${analyses.length} most added players across major fantasy football platforms `;
    intro += `to help you make informed waiver wire decisions.\n\n`;
    
    intro += `Each player has been evaluated based on multiple factors including recent performance, `;
    intro += `opportunity, injury status, and upcoming matchups. Our recommendations come with `;
    intro += `confidence ratings and suggested FAAB percentages to guide your bidding strategy.\n\n`;
    
    const buyCount = analyses.filter(a => a.recommendation === 'BUY').length;
    if (buyCount > 0) {
      intro += `**Key Takeaway:** ${buyCount} player${buyCount > 1 ? 's' : ''} earned BUY recommendations this week, `;
      intro += `with varying levels of investment suggested based on their upside and risk profiles.`;
    } else {
      intro += `**Key Takeaway:** Despite their popularity, we recommend exercising caution with `;
      intro += `this week's most added players due to various risk factors detailed below.`;
    }

    return intro;
  }

  private createExecutiveSummarySection(analyses: PlayerAnalysis[]): string {
    let summary = `## Executive Summary\n\n`;
    
    // Quick stats
    const buyCount = analyses.filter(a => a.recommendation === 'BUY').length;
    const passCount = analyses.filter(a => a.recommendation === 'PASS').length;
    const avgConfidence = Math.round(analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length);
    
    summary += `**Analysis Overview:**\n`;
    summary += `- **Total Players Analyzed:** ${analyses.length}\n`;
    summary += `- **BUY Recommendations:** ${buyCount}\n`;
    summary += `- **PASS Recommendations:** ${passCount}\n`;
    summary += `- **Average Confidence:** ${avgConfidence}%\n\n`;

    // Top recommendations
    const topBuys = analyses
      .filter(a => a.recommendation === 'BUY')
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);

    if (topBuys.length > 0) {
      summary += `**Top BUY Recommendations:**\n`;
      topBuys.forEach((analysis, index) => {
        const faab = analysis.suggestedFAABPercentage ? ` (${analysis.suggestedFAABPercentage}% FAAB)` : '';
        summary += `${index + 1}. **${analysis.player.name}** - ${analysis.confidence}% confidence${faab}\n`;
      });
      summary += '\n';
    }

    // Key themes
    summary += this.identifyKeyThemes(analyses);

    return summary;
  }

  private identifyKeyThemes(analyses: PlayerAnalysis[]): string {
    let themes = `**Key Themes This Week:**\n`;
    
    // Analyze common risk factors and upside points
    const allRiskFactors = analyses.flatMap(a => a.riskFactors);
    const allUpside = analyses.flatMap(a => a.upside);
    
    // Count common themes
    const riskThemes = this.countThemes(allRiskFactors);
    const upsideThemes = this.countThemes(allUpside);
    
    // Identify position trends
    const positionBreakdown = this.analyzePositionTrends(analyses);
    
    if (Object.keys(positionBreakdown).length > 0) {
      themes += `- **Position Focus:** ${this.formatPositionTrends(positionBreakdown)}\n`;
    }
    
    if (riskThemes.length > 0) {
      themes += `- **Common Concerns:** ${riskThemes.slice(0, 2).join(', ')}\n`;
    }
    
    if (upsideThemes.length > 0) {
      themes += `- **Opportunity Drivers:** ${upsideThemes.slice(0, 2).join(', ')}\n`;
    }

    return themes + '\n';
  }

  private countThemes(items: string[]): string[] {
    const themeMap = new Map<string, number>();
    
    items.forEach(item => {
      if (!item || typeof item !== 'string') return;
      
      // Extract key themes from text
      const lowerItem = item.toLowerCase();
      if (lowerItem.includes('injury') || lowerItem.includes('questionable') || lowerItem.includes('out')) {
        themeMap.set('injury concerns', (themeMap.get('injury concerns') || 0) + 1);
      }
      if (lowerItem.includes('snap') || lowerItem.includes('usage') || lowerItem.includes('role')) {
        themeMap.set('usage/role changes', (themeMap.get('usage/role changes') || 0) + 1);
      }
      if (lowerItem.includes('matchup') || lowerItem.includes('schedule')) {
        themeMap.set('schedule factors', (themeMap.get('schedule factors') || 0) + 1);
      }
      if (lowerItem.includes('opportunity') || lowerItem.includes('starter') || lowerItem.includes('increased')) {
        themeMap.set('increased opportunity', (themeMap.get('increased opportunity') || 0) + 1);
      }
    });
    
    return Array.from(themeMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([theme]) => theme);
  }

  private analyzePositionTrends(analyses: PlayerAnalysis[]): Record<string, { buy: number; total: number }> {
    const positionMap = new Map<string, { buy: number; total: number }>();
    
    analyses.forEach(analysis => {
      if (!analysis || !analysis.player || !analysis.player.position) return;
      
      const pos = analysis.player.position;
      const current = positionMap.get(pos) || { buy: 0, total: 0 };
      
      current.total++;
      if (analysis.recommendation === 'BUY') {
        current.buy++;
      }
      
      positionMap.set(pos, current);
    });
    
    return Object.fromEntries(positionMap);
  }

  private formatPositionTrends(breakdown: Record<string, { buy: number; total: number }>): string {
    const trends = Object.entries(breakdown)
      .map(([pos, data]) => {
        const percentage = Math.round((data.buy / data.total) * 100);
        return `${pos} (${data.buy}/${data.total} buys, ${percentage}%)`;
      })
      .join(', ');
    
    return trends;
  }

  private createPlayerAnalysisSections(analyses: PlayerAnalysis[]): string {
    let content = `## Player Analysis\n\n`;
    
    // Sort players by recommendation (BUY first) then by confidence
    const sortedAnalyses = [...analyses].sort((a, b) => {
      if (a.recommendation !== b.recommendation) {
        return a.recommendation === 'BUY' ? -1 : 1;
      }
      return b.confidence - a.confidence;
    });

    sortedAnalyses.forEach((analysis, index) => {
      content += this.createPlayerSection(analysis, index + 1);
      content += '\n\n';
    });

    return content;
  }

  private createPlayerSection(analysis: PlayerAnalysis, rank: number): string {
    const player = analysis.player;
    const recommendation = analysis.recommendation;
    const confidence = analysis.confidence;
    const faab = analysis.suggestedFAABPercentage;
    
    // Section header with recommendation badge
    let section = `### ${rank}. ${player.name} (${player.position}, ${player.team})\n\n`;
    
    // Recommendation badge
    const badge = recommendation === 'BUY' ? '🟢 **BUY**' : '🔴 **PASS**';
    const faabText = faab ? ` | **Suggested FAAB:** ${faab}%` : '';
    section += `${badge} | **Confidence:** ${confidence}%${faabText}\n\n`;
    
    // Addition stats
    section += `**Manager Interest:** ${player.additionPercentage}% of leagues adding `;
    section += `(${player.additionCount.toLocaleString()} additions across ${player.platforms.join(', ')})\n\n`;
    
    // Analysis reasoning
    section += `**Analysis:**\n`;
    analysis.reasoning.forEach(reason => {
      section += `- ${reason}\n`;
    });
    section += '\n';
    
    // Upside factors (if any)
    if (analysis.upside.length > 0) {
      section += `**Upside Factors:**\n`;
      analysis.upside.forEach(upside => {
        section += `- ${upside}\n`;
      });
      section += '\n';
    }
    
    // Risk factors (if any)
    if (analysis.riskFactors.length > 0) {
      section += `**Risk Factors:**\n`;
      analysis.riskFactors.forEach(risk => {
        section += `- ${risk}\n`;
      });
      section += '\n';
    }
    
    // Bottom line recommendation
    section += `**Bottom Line:** `;
    if (recommendation === 'BUY') {
      section += `Worth targeting with ${faab || 'moderate'}% of your FAAB budget. `;
      section += analysis.reasoning[0] || 'Multiple positive factors align for potential value.';
    } else {
      section += `Despite the popularity, pass on this addition. `;
      section += analysis.reasoning[0] || 'Risk factors outweigh potential upside.';
    }

    return section;
  }

  private createConclusionSection(analyses: PlayerAnalysis[]): string {
    let conclusion = `## Final Thoughts\n\n`;
    
    const buyCount = analyses.filter(a => a.recommendation === 'BUY').length;
    const totalFAAB = analyses
      .filter(a => a.recommendation === 'BUY' && a.suggestedFAABPercentage)
      .reduce((sum, a) => sum + (a.suggestedFAABPercentage || 0), 0);
    
    if (buyCount > 0) {
      conclusion += `This week presents ${buyCount} solid FAAB target${buyCount > 1 ? 's' : ''} `;
      if (totalFAAB > 0) {
        conclusion += `requiring approximately ${Math.round(totalFAAB)}% of your total budget if pursuing all recommendations. `;
      }
      conclusion += `Prioritize based on your roster needs and remaining FAAB percentage.\n\n`;
      
      conclusion += `**FAAB Strategy Tips:**\n`;
      conclusion += `- Don't chase popular names without substance\n`;
      conclusion += `- Consider your league's bidding tendencies\n`;
      conclusion += `- Save budget for potential breakout candidates\n`;
      conclusion += `- Factor in bye weeks and playoff schedules\n\n`;
    } else {
      conclusion += `This week's popular additions don't offer compelling value for FAAB investment. `;
      conclusion += `Consider this an opportunity to save budget for future weeks when better options emerge.\n\n`;
      
      conclusion += `**Alternative Strategies:**\n`;
      conclusion += `- Look for less popular players with upside\n`;
      conclusion += `- Focus on handcuff situations\n`;
      conclusion += `- Target players returning from injury\n`;
      conclusion += `- Save FAAB for playoff push additions\n\n`;
    }
    
    conclusion += `Remember that FAAB success comes from identifying value before the crowd, not chasing `;
    conclusion += `after players everyone else wants. Use this analysis as a starting point, but always `;
    conclusion += `consider your specific league context and roster construction.\n\n`;
    
    conclusion += `Good luck with your waiver claims, and may your FAAB investments pay dividends!`;

    return conclusion;
  }

  // Task 7.3: Create metadata and SEO optimization

  /**
   * Generate blog post metadata with SEO optimization
   */
  private generateBlogMetadata(analyses: PlayerAnalysis[], title: string, summary: string): BlogMetadata {
    const currentWeek = this.getCurrentWeek();
    
    // Generate SEO-optimized title and description
    const seoTitle = BlogTransformer.optimizeSEOTitle(title);
    const seoDescription = BlogTransformer.optimizeSEODescription(summary);
    
    // Generate tags based on content
    const tags = this.generateSEOTags(analyses, currentWeek);
    
    // Generate categories
    const categories = this.generateCategories(analyses);
    
    const metadata: BlogMetadata = {
      tags: BlogTransformer.cleanTags(tags),
      categories: BlogTransformer.cleanCategories(categories),
      author: 'Fantasy Football FAAB Analyzer',
      seoTitle,
      seoDescription,
      customFields: {
        week: currentWeek,
        season: new Date().getFullYear(),
        analysisCount: analyses.length,
        buyRecommendations: analyses.filter(a => a.recommendation === 'BUY').length,
        averageConfidence: Math.round(analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length),
        readingTime: BlogTransformer.estimateReadingTime(this.createBlogPostContent(analyses))
      }
    };

    return metadata;
  }

  /**
   * Generate SEO-friendly tags and keywords
   */
  private generateSEOTags(analyses: PlayerAnalysis[], week: number): string[] {
    const baseTags = [
      'fantasy football',
      'faab',
      'waiver wire',
      `week ${week}`,
      'free agents',
      'fantasy analysis',
      'waiver claims'
    ];
    
    // Add position-specific tags
    const positions = [...new Set(analyses.map(a => a.player.position))];
    positions.forEach(pos => {
      baseTags.push(`fantasy ${pos.toLowerCase()}`);
    });
    
    // Add player-specific tags for BUY recommendations
    const buyPlayers = analyses
      .filter(a => a.recommendation === 'BUY')
      .slice(0, 3) // Top 3 only
      .map(a => a.player.name.toLowerCase());
    
    baseTags.push(...buyPlayers);
    
    // Add theme-based tags
    const hasInjuryOpportunity = analyses.some(a => 
      a.upside.some(u => u.toLowerCase().includes('injury')) ||
      a.reasoning.some(r => r.toLowerCase().includes('starter'))
    );
    
    if (hasInjuryOpportunity) {
      baseTags.push('injury replacement', 'opportunity');
    }
    
    const hasBreakout = analyses.some(a =>
      a.upside.some(u => u.toLowerCase().includes('breakout')) ||
      a.reasoning.some(r => r.toLowerCase().includes('breakout'))
    );
    
    if (hasBreakout) {
      baseTags.push('breakout candidate', 'sleeper pick');
    }
    
    return baseTags;
  }

  /**
   * Generate blog categories
   */
  private generateCategories(analyses: PlayerAnalysis[]): string[] {
    const categories = ['Fantasy Football', 'FAAB Analysis', 'Waiver Wire'];
    
    // Add week-specific category
    const currentWeek = this.getCurrentWeek();
    categories.push(`Week ${currentWeek}`);
    
    // Add position categories if dominated by specific positions
    const positionCounts = analyses.reduce((acc, a) => {
      acc[a.player.position] = (acc[a.player.position] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const dominantPosition = Object.entries(positionCounts)
      .sort((a, b) => b[1] - a[1])[0];
    
    if (dominantPosition && dominantPosition[1] >= analyses.length * 0.4) {
      categories.push(`${dominantPosition[0]} Analysis`);
    }
    
    // Add strategy category based on recommendations
    const buyCount = analyses.filter(a => a.recommendation === 'BUY').length;
    if (buyCount === 0) {
      categories.push('Conservative Strategy');
    } else if (buyCount >= analyses.length * 0.7) {
      categories.push('Aggressive Strategy');
    } else {
      categories.push('Balanced Strategy');
    }
    
    return categories;
  }

  /**
   * Create social media preview optimization
   */
  public generateSocialPreview(blogPost: BlogPost): {
    title: string;
    description: string;
    hashtags: string[];
  } {
    // Optimize title for social media (shorter)
    let socialTitle = blogPost.title;
    if (socialTitle.length > 60) {
      socialTitle = socialTitle.substring(0, 57) + '...';
    }
    
    // Create engaging description
    const buyCount = blogPost.metadata.customFields?.buyRecommendations || 0;
    const week = blogPost.metadata.customFields?.week || this.getCurrentWeek();
    
    let description = `Week ${week} FAAB analysis is here! `;
    if (buyCount > 0) {
      description += `${buyCount} players worth your waiver budget this week. `;
    } else {
      description += `Why you should save your FAAB this week. `;
    }
    description += `Full analysis with confidence ratings and bid suggestions.`;
    
    // Generate hashtags
    const hashtags = [
      '#FantasyFootball',
      '#FAAB',
      '#WaiverWire',
      `#Week${week}`,
      '#FantasyAnalysis'
    ];
    
    // Add position hashtags
    const positions = blogPost.metadata.tags
      .filter(tag => tag.startsWith('fantasy '))
      .map(tag => `#${tag.replace('fantasy ', '').toUpperCase()}`);
    
    hashtags.push(...positions.slice(0, 2));
    
    return {
      title: socialTitle,
      description,
      hashtags
    };
  }

  // Task 7.2: Implement content formatting and styling

  /**
   * Format content for HTML publication
   */
  public formatForHTML(blogPost: BlogPost): string {
    let htmlContent = this.convertMarkdownToHTML(blogPost.content);
    
    // Apply consistent styling
    htmlContent = this.applyHTMLStyling(htmlContent);
    
    // Add structured data
    htmlContent = this.addStructuredData(htmlContent, blogPost);
    
    return htmlContent;
  }

  /**
   * Format content for Markdown publication
   */
  public formatForMarkdown(blogPost: BlogPost): string {
    let markdownContent = blogPost.content;
    
    // Ensure consistent markdown formatting
    markdownContent = this.standardizeMarkdownFormatting(markdownContent);
    
    // Add frontmatter
    markdownContent = this.addMarkdownFrontmatter(markdownContent, blogPost);
    
    return markdownContent;
  }

  /**
   * Convert markdown to HTML with proper formatting
   */
  private convertMarkdownToHTML(markdown: string): string {
    let html = markdown;
    
    // Convert headers
    html = html.replace(/^### (.*$)/gm, '<h3 class="player-analysis-header">$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2 class="section-header">$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1 class="main-header">$1</h1>');
    
    // Convert bold text
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convert bullet points
    html = html.replace(/^- (.*$)/gm, '<li>$1</li>');
    
    // Wrap consecutive list items in ul tags
    html = html.replace(/(<li>.*<\/li>\s*)+/gs, (match) => {
      return `<ul class="analysis-list">\n${match}</ul>\n`;
    });
    
    // Convert recommendation badges (handle both markdown and already converted bold)
    html = html.replace(/🟢 \*\*BUY\*\*/g, '<span class="recommendation-badge buy-badge">🟢 BUY</span>');
    html = html.replace(/🔴 \*\*PASS\*\*/g, '<span class="recommendation-badge pass-badge">🔴 PASS</span>');
    html = html.replace(/🟢 <strong>BUY<\/strong>/g, '<span class="recommendation-badge buy-badge">🟢 BUY</span>');
    html = html.replace(/🔴 <strong>PASS<\/strong>/g, '<span class="recommendation-badge pass-badge">🔴 PASS</span>');
    
    // Convert confidence and FAAB info
    html = html.replace(/\*\*Confidence:\*\* (\d+)%/g, '<span class="confidence-score">Confidence: $1%</span>');
    html = html.replace(/\*\*Suggested FAAB:\*\* (\d+(?:\.\d+)?)%/g, '<span class="faab-suggestion">Suggested FAAB: $1%</span>');
    
    // Convert paragraphs
    html = html.replace(/\n\n/g, '</p>\n<p>');
    html = `<p>${html}</p>`;
    
    // Clean up empty paragraphs and fix structure
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<h[1-6])/g, '$1');
    html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ul)/g, '$1');
    html = html.replace(/(<\/ul>)<\/p>/g, '$1');
    html = html.replace(/<p>(<span class="recommendation-badge)/g, '$1');
    html = html.replace(/(<\/span>)<\/p>/g, '$1');
    
    return html;
  }

  /**
   * Apply consistent HTML styling and structure
   */
  private applyHTMLStyling(html: string): string {
    // Wrap in article container
    let styledHTML = `<article class="faab-analysis-post">\n${html}\n</article>`;
    
    // Add CSS classes for better styling
    styledHTML = styledHTML.replace(/<h1 class="main-header">(.*?)<\/h1>/g, 
      '<header class="post-header">\n<h1 class="main-header">$1</h1>\n</header>');
    
    // Wrap sections in containers
    styledHTML = styledHTML.replace(/<h2 class="section-header">(.*?)<\/h2>/g, 
      '<section class="analysis-section">\n<h2 class="section-header">$1</h2>');
    
    // Close sections (simplified - would need more sophisticated parsing in real implementation)
    styledHTML = styledHTML.replace(/(<section class="analysis-section">[\s\S]*?)(?=<section class="analysis-section">|<\/article>)/g, 
      '$1\n</section>');
    
    // Add player cards for individual analyses
    styledHTML = styledHTML.replace(/<h3 class="player-analysis-header">(.*?)<\/h3>/g, 
      '<div class="player-card">\n<h3 class="player-analysis-header">$1</h3>');
    
    // Close player cards (simplified)
    styledHTML = styledHTML.replace(/(<div class="player-card">[\s\S]*?)(?=<div class="player-card">|<\/section>|<\/article>)/g, 
      '$1\n</div>');
    
    return styledHTML;
  }

  /**
   * Add structured data for SEO
   */
  private addStructuredData(html: string, blogPost: BlogPost): string {
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": blogPost.title,
      "description": blogPost.summary,
      "author": {
        "@type": "Person",
        "name": blogPost.metadata.author
      },
      "datePublished": blogPost.publishDate.toISOString(),
      "dateModified": blogPost.publishDate.toISOString(),
      "keywords": blogPost.metadata.tags.join(", "),
      "articleSection": blogPost.metadata.categories[0] || "Fantasy Football",
      "wordCount": this.estimateWordCount(blogPost.content),
      "timeRequired": `PT${blogPost.metadata.customFields?.readingTime || 5}M`
    };
    
    const scriptTag = `<script type="application/ld+json">\n${JSON.stringify(structuredData, null, 2)}\n</script>`;
    
    return `${scriptTag}\n${html}`;
  }

  /**
   * Standardize markdown formatting for consistency
   */
  private standardizeMarkdownFormatting(markdown: string): string {
    let formatted = markdown;
    
    // Ensure consistent header spacing
    formatted = formatted.replace(/^(#{1,6})\s*(.*$)/gm, '$1 $2');
    
    // Ensure consistent list formatting
    formatted = formatted.replace(/^[\s]*[-*+]\s+(.*$)/gm, '- $1');
    
    // Ensure consistent bold formatting
    formatted = formatted.replace(/\*([^*]+)\*/g, '**$1**');
    
    // Ensure consistent line breaks
    formatted = formatted.replace(/\n{3,}/g, '\n\n');
    
    // Ensure proper spacing around headers
    formatted = formatted.replace(/\n(#{1,6}.*)\n/g, '\n\n$1\n\n');
    
    // Clean up extra spaces
    formatted = formatted.replace(/[ \t]+$/gm, '');
    
    return formatted.trim();
  }

  /**
   * Add frontmatter for markdown-based platforms
   */
  private addMarkdownFrontmatter(content: string, blogPost: BlogPost): string {
    const frontmatter = [
      '---',
      `title: "${blogPost.title}"`,
      `description: "${blogPost.summary}"`,
      `author: "${blogPost.metadata.author}"`,
      `date: ${blogPost.publishDate.toISOString()}`,
      `tags: [${blogPost.metadata.tags.map(tag => `"${tag}"`).join(', ')}]`,
      `categories: [${blogPost.metadata.categories.map(cat => `"${cat}"`).join(', ')}]`,
      `seo_title: "${blogPost.metadata.seoTitle || blogPost.title}"`,
      `seo_description: "${blogPost.metadata.seoDescription || blogPost.summary}"`,
      `reading_time: ${blogPost.metadata.customFields?.readingTime || 5}`,
      `week: ${blogPost.metadata.customFields?.week || this.getCurrentWeek()}`,
      `season: ${blogPost.metadata.customFields?.season || new Date().getFullYear()}`,
      '---',
      ''
    ].join('\n');
    
    return frontmatter + content;
  }

  /**
   * Apply consistent tone and style guidelines
   */
  public applyStyleGuidelines(content: string): string {
    let styled = content;
    
    // Ensure consistent terminology
    const terminologyMap = new Map([
      ['waiver wire', 'waiver wire'],
      ['free agent', 'free agent'],
      ['FAAB', 'FAAB'],
      ['fantasy football', 'fantasy football'],
      ['buy recommendation', 'BUY recommendation'],
      ['pass recommendation', 'PASS recommendation']
    ]);
    
    terminologyMap.forEach((correct, variations) => {
      const regex = new RegExp(variations, 'gi');
      styled = styled.replace(regex, correct);
    });
    
    // Ensure consistent voice (active, direct)
    styled = styled.replace(/should be targeted/g, 'target');
    styled = styled.replace(/can be considered/g, 'consider');
    styled = styled.replace(/it is recommended/g, 'we recommend');
    
    // Ensure consistent formatting for player names
    styled = styled.replace(/\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g, (match) => {
      // Don't format if already in bold or header
      if (styled.indexOf(`**${match}**`) !== -1 || styled.indexOf(`# ${match}`) !== -1) {
        return match;
      }
      return match;
    });
    
    return styled;
  }

  /**
   * Generate table of contents for long posts
   */
  public generateTableOfContents(content: string): string {
    const headers = content.match(/^#{2,3}\s+(.*)$/gm) || [];
    
    if (headers.length < 3) {
      return ''; // Don't add TOC for short posts
    }
    
    let toc = '## Table of Contents\n\n';
    
    headers.forEach(header => {
      const level = (header.match(/^#+/) || [''])[0].length;
      const text = header.replace(/^#+\s+/, '');
      const anchor = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      
      const indent = '  '.repeat(level - 2);
      toc += `${indent}- [${text}](#${anchor})\n`;
    });
    
    return toc + '\n';
  }

  /**
   * Add responsive image handling for web publication
   */
  public optimizeImagesForWeb(content: string): string {
    // Replace any image references with responsive versions
    let optimized = content.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g, 
      '<img src="$2" alt="$1" class="responsive-image" loading="lazy" />'
    );
    
    // Add figure captions where appropriate
    optimized = optimized.replace(
      /<img([^>]+)alt="([^"]+)"([^>]*)>/g,
      '<figure class="image-figure"><img$1alt="$2"$3><figcaption>$2</figcaption></figure>'
    );
    
    return optimized;
  }

  /**
   * Format content for different publication platforms
   */
  public formatForPlatform(blogPost: BlogPost, platform: 'wordpress' | 'medium' | 'ghost' | 'markdown'): string {
    switch (platform) {
      case 'wordpress':
        return this.formatForWordPress(blogPost);
      case 'medium':
        return this.formatForMedium(blogPost);
      case 'ghost':
        return this.formatForGhost(blogPost);
      case 'markdown':
        return this.formatForMarkdown(blogPost);
      default:
        return this.formatForHTML(blogPost);
    }
  }

  private formatForWordPress(blogPost: BlogPost): string {
    let content = this.formatForHTML(blogPost);
    
    // WordPress-specific formatting
    content = content.replace(/<article class="faab-analysis-post">/g, '<div class="wp-block-group faab-analysis">');
    content = content.replace(/<\/article>/g, '</div>');
    
    // Add WordPress blocks
    content = content.replace(/<section class="analysis-section">/g, '<div class="wp-block-group analysis-section">');
    content = content.replace(/<\/section>/g, '</div>');
    
    return content;
  }

  private formatForMedium(blogPost: BlogPost): string {
    // Medium uses a simplified HTML format
    let content = blogPost.content;
    
    // Convert to Medium-friendly format
    content = content.replace(/^### /gm, '## ');
    content = content.replace(/^## /gm, '# ');
    content = content.replace(/^# /gm, '# ');
    
    // Medium doesn't support complex HTML, keep it simple
    return content;
  }

  private formatForGhost(blogPost: BlogPost): string {
    let content = this.formatForHTML(blogPost);
    
    // Ghost-specific formatting
    content = content.replace(/<article class="faab-analysis-post">/g, '<div class="kg-card-markdown">');
    content = content.replace(/<\/article>/g, '</div>');
    
    return content;
  }

  // Helper methods

  private estimateWordCount(content: string): number {
    const plainText = content.replace(/<[^>]*>/g, '').replace(/[#*\-]/g, '');
    return plainText.split(/\s+/).filter(word => word.length > 0).length;
  }

  private getCurrentWeek(): number {
    // Simplified week calculation - in real implementation would use proper NFL week calculation
    const now = new Date();
    const seasonStart = new Date(now.getFullYear(), 8, 1); // September 1st
    const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.max(1, Math.min(weeksSinceStart + 1, 18));
  }
}