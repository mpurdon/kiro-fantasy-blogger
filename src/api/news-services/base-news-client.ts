// Base class for news service API clients

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { RateLimiter } from '../rate-limiter';
import { CacheManager } from '../cache-manager';
import { NewsServiceConfig } from '../../models/config';
import { NewsAPIError, APIResponse } from './types';

export abstract class BaseNewsClient {
  protected axios: AxiosInstance;
  protected rateLimiter: RateLimiter;
  protected cache: CacheManager;
  protected config: NewsServiceConfig;
  protected authenticated: boolean = false;

  constructor(config: NewsServiceConfig) {
    this.config = config;
    
    this.axios = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: {
        'User-Agent': 'Fantasy-Football-FAAB-Blog/1.0.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    this.rateLimiter = new RateLimiter(config.rateLimit);
    this.cache = new CacheManager({
      defaultTTL: 600000, // 10 minutes for news
      maxSize: 500
    });

    this.setupInterceptors();
  }

  protected setupInterceptors(): void {
    // Request interceptor for rate limiting and authentication
    this.axios.interceptors.request.use(
      async (config) => {
        await this.rateLimiter.checkRateLimit();
        return this.addAuthHeaders(config) as any;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const newsError = new NewsAPIError(
          error.message || 'News API request failed',
          this.config.name,
          error.response?.status,
          error.response?.data
        );
        return Promise.reject(newsError);
      }
    );
  }

  protected abstract addAuthHeaders(config: AxiosRequestConfig): AxiosRequestConfig;
  
  public abstract getPlayerNews(playerId: string, playerName: string): Promise<any[]>;
  
  public abstract getRecentNews(limit?: number): Promise<any[]>;
  
  public abstract searchNews(query: string, limit?: number): Promise<any[]>;

  public isAuthenticated(): boolean {
    return this.authenticated;
  }

  protected async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    useCache: boolean = true,
    cacheTTL?: number
  ): Promise<APIResponse<T>> {
    const cacheKey = `${method}:${endpoint}:${JSON.stringify(data || {})}`;
    
    // Check cache first for GET requests
    if (method === 'GET' && useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached as APIResponse<T>;
      }
    }

    try {
      let response: AxiosResponse<T>;
      
      switch (method) {
        case 'GET':
          response = await this.axios.get(endpoint, { params: data });
          break;
        case 'POST':
          response = await this.axios.post(endpoint, data);
          break;
        case 'PUT':
          response = await this.axios.put(endpoint, data);
          break;
        case 'DELETE':
          response = await this.axios.delete(endpoint);
          break;
        default:
          throw new Error(`Unsupported HTTP method: ${method}`);
      }

      const apiResponse: APIResponse<T> = {
        data: response.data,
        status: response.status,
        headers: response.headers as Record<string, string>,
        timestamp: new Date()
      };

      // Cache successful GET responses
      if (method === 'GET' && useCache && response.status === 200) {
        this.cache.set(cacheKey, apiResponse, cacheTTL);
      }

      return apiResponse;
    } catch (error) {
      if (error instanceof NewsAPIError) {
        throw error;
      }
      
      throw new NewsAPIError(
        `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.config.name,
        undefined,
        error
      );
    }
  }

  protected async get<T>(endpoint: string, params?: any, useCache: boolean = true, cacheTTL?: number): Promise<APIResponse<T>> {
    return this.makeRequest<T>('GET', endpoint, params, useCache, cacheTTL);
  }

  protected async post<T>(endpoint: string, data?: any): Promise<APIResponse<T>> {
    return this.makeRequest<T>('POST', endpoint, data, false);
  }

  protected handleError(error: any, context: string): never {
    if (error instanceof NewsAPIError) {
      throw error;
    }
    
    throw new NewsAPIError(
      `${context}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      this.config.name,
      undefined,
      error
    );
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public getCacheStats() {
    return this.cache.getStats();
  }

  public getRateLimitStatus() {
    return {
      remaining: this.rateLimiter.getRemainingRequests(),
      resetTimes: this.rateLimiter.getResetTimes()
    };
  }
}