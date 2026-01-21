import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

interface ConfigValue {
  [key: string]: any;
}



interface ValidationError {
  field: string;
  message: string;
}

class ConfigManager {
  private config: ConfigValue = {};
  private rawConfig: ConfigValue = {};

  async load(): Promise<void> {
    try {
      const configPath = path.join(process.cwd(), 'config.yaml');

      if (fs.existsSync(configPath)) {
        const fileContent = fs.readFileSync(configPath, 'utf-8');
        this.rawConfig = yaml.parse(fileContent) || {};
        
        // Process the config structure
        this.config = this.processConfig(this.rawConfig);
      }

      // Override with environment variables
      this.loadEnvOverrides();

      // Validate mandatory fields
      this.validateMandatoryFields();
      
      console.log('✅ Configuration loaded successfully');
    } catch (error) {
      console.error('Failed to load configuration:', error);
      throw error;
    }
  }

  private processConfig(obj: any, parentKey: string = ''): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    // Check if this object has _value, _default, or _mandatory
    if ('_value' in obj || '_default' in obj || '_mandatory' in obj) {
      // This is a config field
      let value;
      
      // Priority: _value (if not null/empty) > _default > undefined
      if (obj._value !== undefined && obj._value !== null && obj._value !== '') {
        value = obj._value;
      } else if (obj._default !== undefined) {
        value = obj._default;
      } else {
        value = undefined; // Will be validated if mandatory
      }
      
      return value;
    }

    // Recursively process nested objects
    const result: any = Array.isArray(obj) ? [] : {};
    for (const [key, value] of Object.entries(obj)) {
      if (key.startsWith('_')) continue; // Skip metadata keys at this level
      result[key] = this.processConfig(value, parentKey ? `${parentKey}.${key}` : key);
    }
    
    return result;
  }

  private validateMandatoryFields(): void {
    const errors: ValidationError[] = [];
    this.checkMandatory(this.rawConfig, '', errors);

    if (errors.length > 0) {
      console.error('\n❌ Configuration validation failed:');
      errors.forEach(err => console.error(`   ${err.message}`));
      console.error('');
      throw new Error(`Configuration validation failed: ${errors.length} mandatory field(s) missing`);
    }

    const mandatoryCount = this.countMandatory(this.rawConfig);
    if (mandatoryCount > 0) {
      console.log(`✅ All ${mandatoryCount} mandatory field(s) validated successfully`);
    }
  }

  private checkMandatory(obj: any, parentKey: string, errors: ValidationError[]): void {
    if (!obj || typeof obj !== 'object') return;

    // Check if this object is a config field with _mandatory
    if (obj._mandatory === true) {
      const fieldPath = parentKey;
      
      // Get the processed value (after applying defaults)
      let value = obj._value;
      if (value === undefined || value === null || value === '') {
        // Try default if _value is empty
        if (obj._default !== undefined && obj._default !== null && obj._default !== '') {
          value = obj._default;
        }
      }
      
      // Now check if we still don't have a value (will be checked after env override)
      if (value === undefined || value === null || value === '') {
        // Get the actual value from processed config
        const processedValue = this.get(fieldPath);
        if (processedValue === undefined || processedValue === null || processedValue === '') {
          errors.push({
            field: fieldPath,
            message: `Mandatory field '${fieldPath}' is missing or empty`
          });
        }
      }
      return; // Don't recurse into config field
    }

    // Recurse into nested objects
    for (const [key, value] of Object.entries(obj)) {
      if (key.startsWith('_')) continue;
      const newPath = parentKey ? `${parentKey}.${key}` : key;
      this.checkMandatory(value, newPath, errors);
    }
  }

  private countMandatory(obj: any): number {
    if (!obj || typeof obj !== 'object') return 0;

    let count = 0;
    if (obj._mandatory === true) {
      count = 1;
    }

    for (const [key, value] of Object.entries(obj)) {
      if (key.startsWith('_')) continue;
      count += this.countMandatory(value);
    }

    return count;
  }

  private loadEnvOverrides(): void {
    // Automatically map environment variables to config
    // Converts: database.host -> database_host (env var)
    this.applyEnvOverrides(this.config, '');
  }

  private applyEnvOverrides(obj: any, parentKey: string): void {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return;
    }

    for (const [key, value] of Object.entries(obj)) {
      const fullPath = parentKey ? `${parentKey}.${key}` : key;
      const envVarName = fullPath.replace(/\./g, '_').toUpperCase();
      
      // Check if environment variable exists
      const envValue = process.env[envVarName];
      
      if (envValue !== undefined) {
        // Type conversion based on current value type
        if (typeof value === 'number') {
          obj[key] = parseInt(envValue, 10);
        } else if (typeof value === 'boolean') {
          obj[key] = envValue === 'true' || envValue === '1';
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
          // It's a nested object, continue recursion
          this.applyEnvOverrides(value, fullPath);
        } else {
          obj[key] = envValue;
        }
        
        console.log(`🔄 Override '${fullPath}' from env var '${envVarName}'`);
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Recurse into nested objects even if no env var found
        this.applyEnvOverrides(value, fullPath);
      }
    }
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
