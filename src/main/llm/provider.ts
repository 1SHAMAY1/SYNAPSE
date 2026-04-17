import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

export type ProviderSDK = 'google' | 'openai' | 'anthropic' | 'openai-compatible';

export interface ProviderConfig {
  alias: string;
  sdk: ProviderSDK;
  apiKey: string;
  modelId?: string;
  baseURL?: string;
}

const SDK_REGISTRY: Record<string, any> = {
  'google': (options: any) => createGoogleGenerativeAI({ apiKey: options.apiKey }),
  'openai': (options: any) => createOpenAI({ apiKey: options.apiKey }),
  'anthropic': (options: any) => createAnthropic({ apiKey: options.apiKey }),
  'openai-compatible': (options: any) => createOpenAI({
    apiKey: options.apiKey || 'none',
    baseURL: options.baseURL || 'http://localhost:11434/v1'
  })
};

export class ModelProvider {
  private static instance: ModelProvider;
  private providers: Map<string, any> = new Map(); // alias -> sdk instance
  private config: any = null;

  private constructor() {}

  static getInstance(): ModelProvider {
    if (!ModelProvider.instance) {
      ModelProvider.instance = new ModelProvider();
    }
    return ModelProvider.instance;
  }

  public loadFromConfig(config: any) {
    this.config = config;
    this.providers.clear();
    
    config.providers.forEach((p: ProviderConfig) => {
      const { alias, sdk: rawSdk, apiKey, baseURL } = p;
      
      // Normalize SDK name (e.g. "Google SDK" -> "google")
      const sdk = rawSdk.toLowerCase().replace(/\s+sdk$/i, '').trim();
      
      try {
        const factory = SDK_REGISTRY[sdk];
        if (factory) {
          console.log(`[PROVIDER] Mapping alias "${alias}" -> ${sdk}`);
          this.providers.set(alias.toLowerCase(), factory({ apiKey, baseURL }));
        } else {
          console.warn(`[PROVIDER] Unknown SDK "${sdk}" for alias "${alias}". Available: ${Object.keys(SDK_REGISTRY).join(', ')}`);
        }
      } catch (e) {
        console.error(`[PROVIDER] Failed to init "${alias}":`, e);
      }
    });
  }

  public reload() {
    if (this.config) this.loadFromConfig(this.config);
  }

  getModel(alias?: string) {
    const targetAlias = (alias || this.config?.default_provider_alias || "").toLowerCase().trim();
    if (!targetAlias) throw new Error("No default provider alias set in config.");

    const sdkInstance = this.providers.get(targetAlias);
    const pConfig = this.config.providers.find((p: any) => p.alias.toLowerCase().trim() === targetAlias);

    if (!sdkInstance || !pConfig) {
      throw new Error(`Provider alias "${targetAlias}" is not configured or mapped.`);
    }

    const { modelId } = pConfig;
    
    // ZERO HARDCODING: The sdkInstance is the provider function itself (e.g. google(), openai())
    // We just call it with the modelId the user provided.
    try {
      return sdkInstance(modelId);
    } catch (e: any) {
      throw new Error(`Failed to initialize model "${modelId}" for provider "${targetAlias}": ${e.message}`);
    }
  }

  getAvailableAliases(): string[] {
    return Array.from(this.providers.keys());
  }
}
