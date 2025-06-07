const fs = require('fs');
const path = require('path');

/**
 * Simple logger utility for the manufacturing system
 * Creates structured logs with timestamps and context
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

class Logger {
  constructor(module) {
    this.module = module;
    this.logLevel = process.env.LOG_LEVEL || 'INFO';
    this.currentLevel = LOG_LEVELS[this.logLevel] || LOG_LEVELS.INFO;
  }

  _log(level, message, meta = {}) {
    if (LOG_LEVELS[level] > this.currentLevel) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      module: this.module,
      message,
      ...meta
    };

    // Console output with color coding
    const colors = {
      ERROR: '\x1b[31m', // Red
      WARN: '\x1b[33m',  // Yellow  
      INFO: '\x1b[36m',  // Cyan
      DEBUG: '\x1b[35m'  // Magenta
    };
    const reset = '\x1b[0m';
    
    const coloredLevel = `${colors[level]}${level}${reset}`;
    const output = `${timestamp} [${coloredLevel}] ${this.module}: ${message}`;
    
    if (meta && Object.keys(meta).length > 0) {
      console.log(output, meta);
    } else {
      console.log(output);
    }

    // Write to log file in production
    if (process.env.NODE_ENV === 'production') {
      this._writeToFile(logEntry);
    }
  }

  _writeToFile(logEntry) {
    try {
      const logDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const logFile = path.join(logDir, `app-${new Date().toISOString().split('T')[0]}.log`);
      const logLine = JSON.stringify(logEntry) + '\n';
      
      fs.appendFileSync(logFile, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  error(message, meta) {
    this._log('ERROR', message, meta);
  }

  warn(message, meta) {
    this._log('WARN', message, meta);
  }

  info(message, meta) {
    this._log('INFO', message, meta);
  }

  debug(message, meta) {
    this._log('DEBUG', message, meta);
  }
}

/**
 * Create a logger instance for a specific module
 * @param {string} module - The module name for context
 * @returns {Logger} Logger instance
 */
function createLogger(module) {
  return new Logger(module);
}

module.exports = {
  createLogger,
  Logger
};