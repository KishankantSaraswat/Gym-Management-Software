import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config({ path: './config/config.env' });

/**
 * Configuration for the API logger
 */
export const loggerConfig = {
  // Support both API_LOGGER_ENABLED and ENABLE_LOG / ENABLE_LOGS / LOG_ENABLED
  get enabled() {
    const envVal = process.env.API_LOGGER_ENABLED ?? process.env.ENABLE_LOG ?? process.env.ENABLE_LOGS ?? process.env.LOG_ENABLED;
    if (envVal !== undefined) {
      return envVal === 'true' || envVal === '1';
    }
    return true; // default enabled
  },
  get isProduction() {
    return process.env.NODE_ENV === 'production';
  },
  get bodyLimit() {
    return parseInt(process.env.API_LOGGER_BODY_LIMIT || '10000', 10);
  },
  get slowRequestMs() {
    return parseInt(process.env.API_LOGGER_SLOW_REQUEST_MS || '1000', 10);
  },
  get logRequestBody() {
    const val = process.env.API_LOGGER_REQ_BODY;
    return val === undefined ? true : val === 'true';
  },
  get logResponseBody() {
    const val = process.env.API_LOGGER_RES_BODY;
    return val === undefined ? true : val === 'true';
  },
  get logDbQueries() {
    const val = process.env.API_LOGGER_DB_QUERIES;
    return val === undefined ? true : val === 'true';
  },
  ignoredPaths: ['/ping', '/favicon.ico']
};

// Sensitive keys to redact across request/response/headers/queries
const SENSITIVE_KEY_REGEX = /^(password|confirmpassword|token|accesstoken|refreshtoken|authorization|cookie|set-cookie|secret|apikey|otp|fcmtoken|smtp_password|password_sms_api|serverkey|senderkey|acesstoken|api_access_token|razorpay_key_secret|google_client_secret)$/i;

/**
 * Recursively redact sensitive values from objects or arrays
 */
export function redactSensitiveData(data, depth = 0) {
  if (depth > 8 || data === null || data === undefined) return data;

  if (typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => redactSensitiveData(item, depth + 1));
  }

  const redacted = {};
  for (const [key, val] of Object.entries(data)) {
    if (SENSITIVE_KEY_REGEX.test(key.trim())) {
      redacted[key] = '***MASKED***';
    } else if (typeof val === 'object' && val !== null) {
      redacted[key] = redactSensitiveData(val, depth + 1);
    } else {
      redacted[key] = val;
    }
  }
  return redacted;
}

/**
 * Truncate long strings/payloads cleanly
 */
export function truncatePayload(str, limit = loggerConfig.bodyLimit) {
  if (typeof str !== 'string') {
    try {
      str = JSON.stringify(str);
    } catch {
      str = String(str);
    }
  }
  if (str.length > limit) {
    return str.slice(0, limit) + ` ... [TRUNCATED ${str.length - limit} bytes]`;
  }
  return str;
}

// Global query storage indexed by requestId for correlation
const activeQueriesByReq = new Map();

/**
 * Attach a query to the currently executing request
 */
export function recordSequelizeQuery(requestId, queryData) {
  if (!requestId) return;
  const list = activeQueriesByReq.get(requestId);
  if (list) {
    list.push(queryData);
  }
}

// Current Request Context Async Holder (Fallback without AsyncLocalStorage)
let currentActiveRequestId = null;
export function setCurrentRequestId(reqId) {
  currentActiveRequestId = reqId;
}
export function getCurrentRequestId() {
  return currentActiveRequestId;
}

/**
 * Formats a terminal-friendly professional log
 */
function printTerminalLog(logData) {
  const {
    timestamp,
    requestId,
    method,
    url,
    statusCode,
    durationMs,
    clientIp,
    reqContentType,
    reqHeaders,
    queryParams,
    reqBody,
    resContentType,
    resSize,
    resBody,
    queries,
    error,
    isSlow
  } = logData;

  // ANSI formatting & bright colors
  const reset = '\x1b[0m';
  const bold = '\x1b[1m';
  const dim = '\x1b[2m';
  const underline = '\x1b[4m';

  // Foreground Colors
  const black = '\x1b[30m';
  const white = '\x1b[37m';
  const brightWhite = '\x1b[97m';
  const gray = '\x1b[90m';
  const lightGray = '\x1b[37m';
  
  const cyan = '\x1b[36m';
  const brightCyan = '\x1b[96m';
  const green = '\x1b[32m';
  const brightGreen = '\x1b[92m';
  const yellow = '\x1b[33m';
  const brightYellow = '\x1b[93m';
  const red = '\x1b[31m';
  const brightRed = '\x1b[91m';
  const magenta = '\x1b[35m';
  const brightMagenta = '\x1b[95m';
  const blue = '\x1b[34m';
  const brightBlue = '\x1b[94m';

  // Background Badge Colors
  const bgGreen = '\x1b[42m\x1b[30m';
  const bgYellow = '\x1b[43m\x1b[30m';
  const bgRed = '\x1b[41m\x1b[97m';
  const bgCyan = '\x1b[46m\x1b[30m';
  const bgBlue = '\x1b[44m\x1b[97m';
  const bgMagenta = '\x1b[45m\x1b[97m';
  const bgDarkGray = '\x1b[100m\x1b[97m';

  // 1. Method Badge
  const methodBadges = {
    GET: `${bgBlue} GET ${reset}`,
    POST: `${bgGreen} POST ${reset}`,
    PUT: `${bgYellow} PUT ${reset}`,
    PATCH: `${bgMagenta} PATCH ${reset}`,
    DELETE: `${bgRed} DELETE ${reset}`,
    OPTIONS: `${bgDarkGray} OPTIONS ${reset}`
  };
  const mBadge = methodBadges[method] || `${bgCyan} ${method} ${reset}`;

  // 2. Status Badge
  let statusBadge = `${bgGreen} ${statusCode} OK ${reset}`;
  let statusColor = brightGreen;
  if (statusCode >= 500) {
    statusBadge = `${bgRed} ${statusCode} ERROR ${reset}`;
    statusColor = brightRed;
  } else if (statusCode >= 400) {
    statusBadge = `${bgYellow} ${statusCode} WARN ${reset}`;
    statusColor = brightYellow;
  } else if (statusCode >= 300) {
    statusBadge = `${bgCyan} ${statusCode} REDIR ${reset}`;
    statusColor = brightCyan;
  }

  // 3. Timing & Warnings
  const durationColor = isSlow ? `${bgRed} ⏱ ${durationMs}ms SLOW ${reset}` : (durationMs > 200 ? `${yellow}${durationMs}ms${reset}` : `${green}${durationMs}ms${reset}`);

  // 4. Header Bar
  const borderChar = '─';
  const barLength = 76;
  const headerBorder = `${gray}${borderChar.repeat(barLength)}${reset}`;

  console.log(`\n${headerBorder}`);
  console.log(
    `${mBadge} ${statusBadge} ${bold}${brightWhite}${url}${reset} ${dim}in${reset} ${durationColor}`
  );
  console.log(
    `  ${gray}Time:${reset} ${dim}${timestamp.split('T')[1].replace('Z', '')}${reset}  ` +
    `  ${gray}ReqID:${reset} ${brightCyan}${requestId}${reset}  ` +
    `  ${gray}IP:${reset} ${lightGray}${clientIp}${reset}  ` +
    `  ${gray}ResSize:${reset} ${dim}${resSize}B${reset}`
  );

  // 5. Query Parameters (Bright Purple / Violet)
  if (queryParams && Object.keys(queryParams).length > 0) {
    console.log(`  ${brightMagenta}⚡ QUERY PARAMS:${reset} ${yellow}${JSON.stringify(queryParams)}${reset}`);
  }

  // 6. Request Body (Electric Cyan / Teal)
  if (reqBody && Object.keys(reqBody).length > 0) {
    const bodyStr = truncatePayload(JSON.stringify(reqBody, null, 2));
    console.log(`  ${brightCyan}📥 REQUEST BODY:${reset}\n    ${gray}${bodyStr.replace(/\n/g, '\n    ')}${reset}`);
  }

  // 7. Response Body (Emerald Green for 2xx, Amber for 4xx, Crimson for 5xx)
  if (resBody !== undefined && resBody !== null) {
    let bodyFormatted = '';
    try {
      const parsed = typeof resBody === 'string' ? JSON.parse(resBody) : resBody;
      bodyFormatted = truncatePayload(JSON.stringify(parsed, null, 2));
    } catch {
      bodyFormatted = truncatePayload(String(resBody));
    }
    console.log(`  ${statusColor}📤 RESPONSE BODY:${reset}\n    ${dim}${bodyFormatted.replace(/\n/g, '\n    ')}${reset}`);
  }

  // 8. Database Queries (Lavender / Violet & Amber Timings)
  if (queries && queries.length > 0) {
    const totalDbTime = queries.reduce((acc, q) => acc + (q.duration || 0), 0);
    console.log(`  ${magenta}💾 DATABASE [${queries.length} queries | ${totalDbTime}ms total]:${reset}`);
    queries.forEach((q, idx) => {
      const qTime = q.duration !== undefined ? `${yellow}${q.duration}ms${reset}` : `${gray}n/a${reset}`;
      console.log(`    ${gray}${idx + 1}.${reset} (${qTime}) ${cyan}${truncatePayload(q.sql, 350)}${reset}`);
    });
  }

  // 9. Errors (Bright Red on Dark Background)
  if (error) {
    console.log(`  ${bgRed} ❌ EXCEPTION ${reset} ${bold}${brightRed}${error.message || error}${reset}`);
    if (error.stack && !loggerConfig.isProduction) {
      console.log(`  ${gray}TRACE:${reset}\n${error.stack.split('\n').slice(0, 6).map(l => '    ' + gray + l + reset).join('\n')}`);
    }
  }

  console.log(`${headerBorder}\n`);
}

/**
 * Formats a production-friendly JSON log
 */
function printProductionJsonLog(logData) {
  const jsonRecord = {
    level: logData.statusCode >= 500 ? 'error' : (logData.statusCode >= 400 ? 'warn' : 'info'),
    timestamp: logData.timestamp,
    requestId: logData.requestId,
    method: logData.method,
    url: logData.url,
    statusCode: logData.statusCode,
    durationMs: logData.durationMs,
    clientIp: logData.clientIp,
    reqContentType: logData.reqContentType,
    resContentType: logData.resContentType,
    resSize: logData.resSize,
    isSlow: logData.isSlow,
    queryCount: logData.queries?.length || 0,
    queryParams: logData.queryParams,
    reqBody: loggerConfig.logRequestBody ? logData.reqBody : undefined,
    resBody: loggerConfig.logResponseBody ? (typeof logData.resBody === 'string' ? logData.resBody.slice(0, 1000) : logData.resBody) : undefined,
    error: logData.error ? { message: logData.error.message, name: logData.error.name } : undefined
  };
  console.log(JSON.stringify(jsonRecord));
}

/**
 * Express Middleware for Request/Response Logging
 */
export const apiRequestLogger = (req, res, next) => {
  // If disabled via config / environment, pass through
  if (!loggerConfig.enabled) {
    return next();
  }

  // Skip noisy paths
  if (loggerConfig.ignoredPaths.some(p => req.path === p)) {
    return next();
  }

  const startTime = process.hrtime();
  const requestId = req.headers['x-request-id'] || `req_${crypto.randomBytes(6).toString('hex')}`;
  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);
  setCurrentRequestId(requestId);

  // Initialize query tracking list for this request
  activeQueriesByReq.set(requestId, []);

  // Intercept response methods cleanly without altering behavior or stream
  const originalJson = res.json;
  const originalSend = res.send;
  const originalEnd = res.end;

  let capturedResponseBody = null;
  let isLogged = false;

  res.json = function (body) {
    capturedResponseBody = body;
    return originalJson.apply(this, arguments);
  };

  res.send = function (body) {
    if (capturedResponseBody === null) {
      capturedResponseBody = body;
    }
    return originalSend.apply(this, arguments);
  };

  const finalizeLog = (err = null) => {
    if (isLogged) return;
    isLogged = true;

    const diff = process.hrtime(startTime);
    const durationMs = Math.round((diff[0] * 1e3 + diff[1] * 1e-6) * 100) / 100;

    const queries = activeQueriesByReq.get(requestId) || [];
    activeQueriesByReq.delete(requestId);

    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || 'unknown';
    const reqContentType = req.headers['content-type'] || '';
    const resContentType = res.getHeader('content-type') || '';
    const resSize = res.getHeader('content-length') || (capturedResponseBody ? Buffer.byteLength(typeof capturedResponseBody === 'string' ? capturedResponseBody : JSON.stringify(capturedResponseBody)) : 0);

    const redactedHeaders = redactSensitiveData(req.headers);
    const redactedQuery = redactSensitiveData(req.query);
    const redactedReqBody = loggerConfig.logRequestBody && req.body ? redactSensitiveData(req.body) : null;
    const redactedResBody = loggerConfig.logResponseBody && capturedResponseBody !== null ? redactSensitiveData(capturedResponseBody) : null;

    const logData = {
      timestamp: new Date().toISOString(),
      requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs,
      clientIp,
      reqContentType,
      reqHeaders: redactedHeaders,
      queryParams: redactedQuery,
      reqBody: redactedReqBody,
      resContentType: String(resContentType),
      resSize,
      resBody: redactedResBody,
      queries: loggerConfig.logDbQueries ? queries : [],
      error: err || req.__loggedError || null,
      isSlow: durationMs >= loggerConfig.slowRequestMs
    };

    if (loggerConfig.isProduction) {
      printProductionJsonLog(logData);
    } else {
      printTerminalLog(logData);
    }
  };

  // Capture response finish
  res.on('finish', () => {
    finalizeLog();
  });

  // Capture unexpected connection close
  res.on('close', () => {
    if (!res.writableEnded) {
      finalizeLog(new Error('Connection terminated before response completed'));
    }
  });

  next();
};

