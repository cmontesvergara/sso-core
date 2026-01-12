export class Logger {
  static log(level: string, message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const output = {
      timestamp,
      level,
      message,
      ...(data && { data }),
    };

    if (level === 'error') {
      console.error(JSON.stringify(output));
    } else if (level === 'warn') {
      console.warn(JSON.stringify(output));
    } else {
      console.log(JSON.stringify(output));
    }
  }

  static debug(message: string, data?: any): void {
    this.log('DEBUG', message, data);
  }

  static info(message: string, data?: any): void {
    this.log('INFO', message, data);
  }

  static warn(message: string, data?: any): void {
    this.log('WARN', message, data);
  }

  static error(message: string, error?: any): void {
    this.log('ERROR', message, error);
  }
}
