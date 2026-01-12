import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

interface ConfigValue {
  [key: string]: any;
}

class ConfigManager {
  private config: ConfigValue = {};

  async load(): Promise<void> {
    try {
      const configPath = path.join(process.cwd(), 'config.yaml');

      if (fs.existsSync(configPath)) {
        const fileContent = fs.readFileSync(configPath, 'utf-8');
        this.config = yaml.parse(fileContent) || {};
      }

      // Override with environment variables
      this.loadEnvOverrides();
    } catch (error) {
      console.error('Failed to load configuration:', error);
      throw error;
    }
  }

  private loadEnvOverrides(): void {
    // Port
    if (process.env.PORT) {
      this.config.port = parseInt(process.env.PORT, 10);
    }

    // Host
    if (process.env.HOST) {
      this.config.host = process.env.HOST;
    }

    // Database
    if (!this.config.database) {
      this.config.database = {};
    }
    if (process.env.DB_TYPE) {
      this.config.database.type = process.env.DB_TYPE;
    }
    if (process.env.DB_HOST) {
      this.config.database.host = process.env.DB_HOST;
    }
    if (process.env.DB_PORT) {
      this.config.database.port = parseInt(process.env.DB_PORT, 10);
    }
    if (process.env.DB_NAME) {
      this.config.database.name = process.env.DB_NAME;
    }
    if (process.env.DB_USER) {
      this.config.database.user = process.env.DB_USER;
    }
    if (process.env.DB_PASSWORD) {
      this.config.database.password = process.env.DB_PASSWORD;
    }

    // JWT
    if (!this.config.jwt) {
      this.config.jwt = {};
    }
    if (process.env.JWT_SECRET) {
      this.config.jwt.secret = process.env.JWT_SECRET;
    }
    if (process.env.JWT_ALGORITHM) {
      this.config.jwt.algorithm = process.env.JWT_ALGORITHM;
    }
    if (process.env.JWT_ISS) {
      this.config.jwt.iss = process.env.JWT_ISS;
    }
    if (process.env.JWT_AUD) {
      this.config.jwt.aud = process.env.JWT_AUD;
    }
    if (process.env.JWT_KID) {
      this.config.jwt.kid = process.env.JWT_KID;
    }
    if (process.env.PRIVATE_KEY_PATH) {
      this.config.jwt.private_key_path = process.env.PRIVATE_KEY_PATH;
    }
    if (process.env.PUBLIC_KEY_PATH) {
      this.config.jwt.public_key_path = process.env.PUBLIC_KEY_PATH;
    }

    // Token validity
    if (process.env.ACCESS_TOKEN_VALIDITY) {
      this.config.access_token_validity = parseInt(
        process.env.ACCESS_TOKEN_VALIDITY,
        10
      );
    }
    if (process.env.REFRESH_TOKEN_VALIDITY) {
      this.config.refresh_token_validity = parseInt(
        process.env.REFRESH_TOKEN_VALIDITY,
        10
      );
    }

    // Logging
    if (process.env.LOG_LEVEL) {
      if (!this.config.logging) {
        this.config.logging = {};
      }
      this.config.logging.level = process.env.LOG_LEVEL;
    }

    // CORS defaults
    if (!this.config.cors) this.config.cors = {};
    if (process.env.CORS_ORIGIN) this.config.cors.origin = process.env.CORS_ORIGIN;
    if (process.env.CORS_CREDENTIALS) this.config.cors.credentials = process.env.CORS_CREDENTIALS === 'true';
    if (process.env.CORS_METHODS) this.config.cors.methods = process.env.CORS_METHODS;

    // Rate limit
    if (!this.config.rateLimit) this.config.rateLimit = {};
    if (process.env.RATE_LIMIT_WINDOW_MS) this.config.rateLimit.windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10);
    if (process.env.RATE_LIMIT_MAX) this.config.rateLimit.max = parseInt(process.env.RATE_LIMIT_MAX, 10);

    // Database URL (convenience)
    if (process.env.DATABASE_URL) this.config.database.url = process.env.DATABASE_URL;
  }

  get(key: string, defaultValue?: any): any {
    const keys = key.split('.');
    let value = this.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }

    return value;
  }

  set(key: string, value: any): void {
    const keys = key.split('.');
    const lastKey = keys.pop();

    if (!lastKey) return;

    let current = this.config;
    for (const k of keys) {
      if (!(k in current)) {
        current[k] = {};
      }
      current = current[k];
    }

    current[lastKey] = value;
  }

  getAll(): ConfigValue {
    return this.config;
  }
}

export const Config = new ConfigManager();
