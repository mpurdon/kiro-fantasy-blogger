// Base class for fantasy platform API clients

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { RateLimiter } from '../rate-limiter';
import { CacheManager } from '../cache-manager';
import { PlatformConfig } from '../../models/config';
import { PlatformAPIError, APIResponse, PlatformAuthConfig } from './types';

export abstract class BaseFantasyClient {
  protected axios: AxiosInstance;
  protected rateLimiter: RateLimiter;
  protected cache: CacheManager;
  protected config: PlatformConfig;
  protected authConfig: PlatformAuthConfig;
  protected authenticated: boolean = false;

  constructor(config: PlatformConfig, authConfig: PlatformAuthConfig = {}) {
    this.config = config;
    this.authConfig = authConfig;
    
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
      defaultTTL: 300000, // 5 minutes
      maxSize: 1000
    });

    this.setupInterceptors();
  }

  protected setupInterceptors(): void {
    // Request interceptor for rate limiting and authentication
    this.axios.interceptors.request.use(
      async (config) => {
        await this.rateLimiter.checkRateLimit();
        return this.addAuthHeaders(config);
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const platformError = new PlatformAPIError(
          error.message || 'API request failed',
          this.config.name,
          error.response?.status,
          error.response?.data
        );
        return Promise.reject(platformError);
      }
    );
  }

  protected abstract addAuthHeaders(config: AxiosRequestConfig): AxiosRequestConfig;
  
  public abstract authenticate(): Promise<void>;
  
  public abstract getMostAddedPlayers(timeframe?: string): Promise<any[]>;
  
  public abstract getPlayerInfo(playerId: string): Promise<any>;

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
      if (error instanceof PlatformAPIError) {
        throw error;
      }
      
      throw new PlatformAPIError(
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

  protected async put<T>(endpoint: string, data?: any): Promise<APIResponse<T>> {
    return this.makeRequest<T>('PUT', endpoint, data, false);
  }

  protected async delete<T>(endpoint: string): Promise<APIResponse<T>> {
    return this.makeRequest<T>('DELETE', endpoint, undefined, false);
  }

  protected handleError(error: any, context: string): never {
    if (error instanceof PlatformAPIError) {
      throw error;
    }
    
    throw new PlatformAPIError(
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