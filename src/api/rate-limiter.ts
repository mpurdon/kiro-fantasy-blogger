// Rate limiting utilities for API clients

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
}

export interface RateLimitState {
  minuteRequests: number;
  hourRequests: number;
  minuteResetTime: number;
  hourResetTime: number;
}

export class RateLimiter {
  private state: RateLimitState;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.state = {
      minuteRequests: 0,
      hourRequests: 0,
      minuteResetTime: Date.now() + 60000, // 1 minute from now
      hourResetTime: Date.now() + 3600000   // 1 hour from now
    };
  }

  async checkRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Reset counters if time windows have passed
    if (now >= this.state.minuteResetTime) {
      this.state.minuteRequests = 0;
      this.state.minuteResetTime = now + 60000;
    }
    
    if (now >= this.state.hourResetTime) {
      this.state.hourRequests = 0;
      this.state.hourResetTime = now + 3600000;
    }
    
    // Check if we've exceeded limits
    if (this.state.minuteRequests >= this.config.requestsPerMinute) {
      const waitTime = this.state.minuteResetTime - now;
      await this.delay(waitTime);
      return this.checkRateLimit(); // Recursive call after waiting
    }
    
    if (this.state.hourRequests >= this.config.requestsPerHour) {
      const waitTime = this.state.hourResetTime - now;
      await this.delay(waitTime);
      return this.checkRateLimit(); // Recursive call after waiting
    }
    
    // Increment counters
    this.state.minuteRequests++;
    this.state.hourRequests++;
  }

  getRemainingRequests(): { minute: number; hour: number } {
    return {
      minute: Math.max(0, this.config.requestsPerMinute - this.state.minuteRequests),
      hour: Math.max(0, this.config.requestsPerHour - this.state.hourRequests)
    };
  }

  getResetTimes(): { minute: Date; hour: Date } {
    return {
      minute: new Date(this.state.minuteResetTime),
      hour: new Date(this.state.hourResetTime)
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class RateLimiterManager {
  private limiters: Map<string, RateLimiter> = new Map();

  createLimiter(name: string, config: RateLimitConfig): RateLimiter {
    const limiter = new RateLimiter(config);
    this.limiters.set(name, limiter);
    return limiter;
  }

  getLimiter(name: string): RateLimiter | undefined {
    return this.limiters.get(name);
  }

  async checkRateLimit(name: string): Promise<void> {
    const limiter = this.limiters.get(name);
    if (!limiter) {
      throw new Error(`Rate limiter '${name}' not found`);
    }
    await limiter.checkRateLimit();
  }

  getAllLimiters(): Map<string, RateLimiter> {
    return new Map(this.limiters);
  }
}