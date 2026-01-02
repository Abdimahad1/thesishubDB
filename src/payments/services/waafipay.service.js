import axios from "axios";

/* =========================
   CONSTANTS & CONFIG
========================= */
const SUCCESS_CODES = ["0", "2001", "200", "00", "1000"];
const PENDING_CODES = ["1002", "1003", "1004", "1005"];
const FAILURE_CODES = ["5206", "5207", "5208", "5209", "5210", "5300", "5301"];

const isProduction = process.env.NODE_ENV === "production";

const log = (...args) => {
  if (!isProduction) console.log(...args);
};

const logError = (...args) => {
  console.error(...args); // errors are allowed
};


// Error messages mapping
const ERROR_MESSAGES = {
  // Insufficient balance errors
  "5206": "Insufficient balance in your account",
  "E10205": "Insufficient balance (Haraaga xisaabtaadu kuguma filna)",
  
  // Transaction limit errors
  "5207": "Transaction limit exceeded",
  "5208": "Daily transaction limit exceeded",
  "5209": "Monthly transaction limit exceeded",
  
  // Account errors
  "5210": "Account not found or inactive",
  "E10208": "Invalid account number",
  
  // Transaction errors
  "E10206": "Transaction declined by user",
  "E10207": "Transaction timeout",
  "E10209": "Service temporarily unavailable",
  
  // General errors
  "5300": "Transaction failed",
  "5301": "System error",
  "5400": "Duplicate transaction",
  "5500": "Invalid request",
  
  // Network/timeout errors
  "NETWORK_ERROR": "Network connection failed. Please check your internet and try again.",
  "TIMEOUT_ERROR": "Payment gateway timeout. Please try again.",
  "CONFIG_ERROR": "Payment service configuration error",
  
  // Default
  "DEFAULT": "Payment failed. Please try again.",
};

/* =========================
   HELPER FUNCTIONS
========================= */

/**
 * Normalize Somali phone number to start with 252
 */
export const normalizePhone = (phone) => {
  if (!phone) {
    throw new Error("Phone number is required");
  }
  
  // Remove all non-digit characters
  let cleaned = phone.toString().replace(/\D/g, '');
  
  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, '');
  
  // Ensure it starts with 252
  if (!cleaned.startsWith('252')) {
    cleaned = `252${cleaned}`;
  }
  
  // Validate length (252 + 9 digits = 12 characters total)
  if (cleaned.length !== 12) {
    throw new Error(`Invalid phone number length. Expected 9 digits after 252, got ${cleaned.length - 3} digits.`);
  }
  
  // Validate it's a valid Somali mobile number
  const validPrefixes = ["25261", "25262", "25263", "25264", "25265", "25266", "25267", "25268", "25269", "25270", "25271", "25279", "25290", "25291"];
  if (!validPrefixes.some(prefix => cleaned.startsWith(prefix))) {
log(`⚠️ Phone number prefix not standard`);
  }
  
  return cleaned;
};

/**
 * Detect mobile carrier from phone number
 */
export const detectCarrier = (phone) => {
  const normalized = normalizePhone(phone);
  
  if (normalized.startsWith("25261")) return "Hormuud";
  if (normalized.startsWith("25262")) return "Somtel";
  if (normalized.startsWith("25264")) return "Somtel";
  if (normalized.startsWith("25265")) return "Hormuud";
  if (normalized.startsWith("25266")) return "Somtel";
  if (normalized.startsWith("25267")) return "Hormuud";
  if (normalized.startsWith("25268")) return "Somtel";
  if (normalized.startsWith("25270")) return "Hormuud";
  if (normalized.startsWith("25271")) return "Hormuud";
  if (normalized.startsWith("25279")) return "Hormuud";
 
  
  return "Unknown";
};

/**
 * Generate unique request ID
 */
const generateRequestId = () => {
  return `TH-REQ-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
};

/**
 * Generate unique reference ID
 */
const generateReferenceId = () => {
  return `TH-REF-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
};

/**
 * Parse and normalize WaafiPay response
 */
export const parseWaafiResponse = (response) => {
  if (!response) {
    return {
      success: false,
      error: true,
      responseCode: "9999",
      responseMsg: "No response from payment gateway",
      userMessage: "Payment service unavailable. Please try again later.",
      transactionStatus: "FAILED",
    };
  }

  // Extract response data
  const responseCode = String(response.responseCode || response.code || "").trim();
  const statusCode = String(response.statusCode || "").trim();
  const transactionStatus = String(response.transactionInfo?.status || "").toUpperCase().trim();
  const responseMsg = String(response.responseMsg || response.responseMessage || "").trim();
  const errorCode = String(response.errorCode || "").trim();

  // Debug logging
  log("🔍 Parsing response:", {
    responseCode,
    statusCode,
    transactionStatus,
    responseMsg,
    errorCode,
  });

  // Determine success
  let success = false;
  if (SUCCESS_CODES.includes(responseCode) || 
      SUCCESS_CODES.includes(statusCode) || 
      transactionStatus === "SUCCESS" ||
      responseMsg.toUpperCase().includes("SUCCESS") ||
      responseMsg.toUpperCase().includes("RCS_SUCCESS") ||
      responseMsg.toUpperCase().includes("COMPLETED")) {
    success = true;
  }

  // Check if pending
  const isPending = PENDING_CODES.includes(responseCode) || 
                    responseMsg.toUpperCase().includes("PENDING") ||
                    transactionStatus === "PENDING";

  // Get user-friendly message
  let userMessage = ERROR_MESSAGES[responseCode] || 
                    ERROR_MESSAGES[errorCode] || 
                    responseMsg || 
                    ERROR_MESSAGES.DEFAULT;

  // Special handling for Somali error messages
  if (responseMsg.includes("Haraaga") || responseMsg.includes("haraaga")) {
    userMessage = "Insufficient balance in your account. Please add funds to your mobile wallet and try again.";
  } else if (responseMsg.includes("waa la diiday") || responseMsg.includes("diiday")) {
    userMessage = "Payment was declined on your phone. Please confirm the transaction when prompted.";
  } else if (responseMsg.includes("waa la iska celiyay")) {
    userMessage = "Payment was cancelled. Please try again.";
  } else if (responseMsg.includes("waa la isku dayay") || responseMsg.includes("isku dayay")) {
    userMessage = "Payment is being processed. Please wait for confirmation.";
  } else if (responseMsg.includes("qalad") || responseMsg.includes("error")) {
    userMessage = "Payment system error. Please try again or contact support.";
  } else if (responseMsg.includes("wakhtiga") || responseMsg.includes("timeout")) {
    userMessage = "Payment timeout. Please try again.";
  } else if (responseMsg.includes("numberka") || responseMsg.includes("invalid")) {
    userMessage = "Invalid phone number. Please check and try again.";
  } else if (responseMsg.includes("lama helin") || responseMsg.includes("not found")) {
    userMessage = "Account not found. Please check the phone number and try again.";
  }

  return {
    success,
    pending: isPending,
    responseCode,
    errorCode,
    statusCode,
    transactionStatus,
    responseMsg,
    userMessage,
    referenceId: response.transactionInfo?.referenceId || response.referenceId,
    invoiceId: response.transactionInfo?.invoiceId,
    amount: response.transactionInfo?.amount,
    currency: response.transactionInfo?.currency,
    timestamp: response.timestamp || new Date().toISOString(),
    rawResponse: response,
  };
};

/**
 * Validate payment parameters
 */
const validatePaymentParams = ({ phone, amount, invoiceId, description }) => {
  const errors = [];
  
  if (!phone) errors.push("Phone number is required");
  if (!amount) errors.push("Amount is required");
  if (!invoiceId) errors.push("Invoice ID is required");
  
  if (amount <= 0) errors.push("Amount must be greater than 0");
  if (amount > 10000) errors.push("Amount cannot exceed $10,000");
  
  if (invoiceId.length > 50) errors.push("Invoice ID is too long");
  
  if (errors.length > 0) {
    throw new Error(`Invalid payment parameters: ${errors.join(", ")}`);
  }
  
  return true;
};

/**
 * Validate environment configuration
 */
const validateEnvConfig = () => {
  const requiredEnvVars = ["PAYMENT_API_URL", "MERCHANT_UID", "API_USER_ID", "API_KEY"];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Payment service not configured. Missing environment variables: ${missingVars.join(", ")}`);
  }
  
  return true;
};

/* =========================
   MAIN PAYMENT SERVICE
========================= */

/**
 * Make payment using WaafiPay API
 */
export const payByWaafiPay = async ({ phone, amount, invoiceId, description = "Project Payment" }) => {
  const requestId = generateRequestId();
  const startTime = Date.now();
  


  try {
    // Validate configuration
    validateEnvConfig();
    
    // Validate parameters
    validatePaymentParams({ phone, amount, invoiceId, description });
    
    // Normalize phone number
    const normalizedPhone = normalizePhone(phone);
    const carrier = detectCarrier(phone);
    

    // Prepare payload
    const payload = {
      schemaVersion: "1.0",
      requestId: requestId,
      timestamp: new Date().toISOString(),
      channelName: "WEB",
      serviceName: "API_PURCHASE",
      serviceParams: {
        merchantUid: process.env.MERCHANT_UID,
        apiUserId: process.env.API_USER_ID,
        apiKey: process.env.API_KEY,
        paymentMethod: "MWALLET_ACCOUNT",
        payerInfo: {
          accountNo: normalizedPhone,
        },
        transactionInfo: {
          referenceId: generateReferenceId(),
          invoiceId: invoiceId.substring(0, 50), // Ensure it's not too long
          amount: parseFloat(Number(amount).toFixed(2)),
          currency: "USD",
          description: description.substring(0, 255), // Limit description length
        },
      },
    };

    log(`📦 [${requestId}] Sending payment request:`);

    // Make API call
    const response = await axios.post(
      process.env.PAYMENT_API_URL,
      payload,
      {
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "ThesisHub/1.0",
        },
        timeout: 45000, // 45 seconds timeout
        maxRedirects: 5,
        validateStatus: function (status) {
          // Don't throw on 4xx errors, we'll handle them
          return status >= 200 && status < 500;
        },
      }
    );

    const processingTime = Date.now() - startTime;
    log(`⏱️ [${requestId}] Response received in ${processingTime}ms`);
    log(`📊 [${requestId}] Response status: ${response.status}`);
    
    // Log response data (safely)
    const responseData = response.data;
    log(`📄 [${requestId}] Response data:`, {
      responseCode: responseData.responseCode,
      responseMsg: responseData.responseMsg,
      transactionStatus: responseData.transactionInfo?.status,
    });

    // Parse and return response
    const parsedResponse = parseWaafiResponse(responseData);
    
    // Add metadata
    parsedResponse.metadata = {
      requestId,
      processingTime,
      carrier,
      normalizedPhone,
      timestamp: new Date().toISOString(),
    };

    log(`📈 [${requestId}] Payment result:`, {
      success: parsedResponse.success,
      pending: parsedResponse.pending,
      responseCode: parsedResponse.responseCode,
      userMessage: parsedResponse.userMessage,
    });

    return parsedResponse;

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`💥 [${requestId}] Payment error after ${processingTime}ms:`, error.message);
    
    let parsedResponse;
    
      if (error.response) {
        logError(`📊 [${requestId}] Gateway error status: ${error.response.status}`);

        parsedResponse = parseWaafiResponse(error.response.data);
      } else if (error.request) {
        // Request made but no response
        console.error(`🚫 [${requestId}] No response received`);
        
        parsedResponse = {
          success: false,
        error: true,
        responseCode: "NETWORK_ERROR",
        responseMsg: "No response from payment gateway",
        userMessage: ERROR_MESSAGES.NETWORK_ERROR,
        transactionStatus: "FAILED",
        rawResponse: null,
      };
      
    } else if (error.code === 'ECONNABORTED') {
      // Request timeout
      console.error(`⏰ [${requestId}] Request timeout`);
      
      parsedResponse = {
        success: false,
        error: true,
        responseCode: "TIMEOUT_ERROR",
        responseMsg: "Request timeout",
        userMessage: "Payment timeout. Please try again.",
        transactionStatus: "FAILED",
        rawResponse: null,
      };
      
    } else {
      // Other errors (validation, configuration, etc.)
      console.error(`⚡ [${requestId}] Setup/validation error:`, error.message);
      
      parsedResponse = {
        success: false,
        error: true,
        responseCode: "CONFIG_ERROR",
        responseMsg: error.message,
        userMessage: error.message.includes("configure") ? 
                   "Payment service configuration error. Please contact support." : 
                   `Payment error: ${error.message}`,
        transactionStatus: "FAILED",
        rawResponse: null,
      };
    }
    
    // Add metadata to error response
    parsedResponse.metadata = {
      requestId,
      processingTime,
      errorType: error.name,
      errorMessage: error.message,
      timestamp: new Date().toISOString(),
    };
    
    return parsedResponse;
  }
};

/**
 * Validate phone number (public helper)
 */
export const validatePhone = (phone) => {
  try {
    const normalized = normalizePhone(phone);
    const carrier = detectCarrier(phone);
    
    return {
      valid: true,
      normalized,
      carrier,
      message: `Valid ${carrier} number`,
    };
  } catch (error) {
    return {
      valid: false,
      normalized: null,
      carrier: null,
      message: error.message,
    };
  }
};

/**
 * Check payment status (if WaafiPay provides this endpoint)
 */
export const checkPaymentStatus = async (referenceId) => {
  if (!process.env.PAYMENT_STATUS_URL) {
    console.warn("⚠️ PAYMENT_STATUS_URL not configured, skipping status check");
    return null;
  }

  try {
    const payload = {
      schemaVersion: "1.0",
      requestId: generateRequestId(),
      timestamp: new Date().toISOString(),
      serviceName: "API_PAYMENT_STATUS",
      serviceParams: {
        merchantUid: process.env.MERCHANT_UID,
        apiUserId: process.env.API_USER_ID,
        apiKey: process.env.API_KEY,
        referenceId,
      },
    };

    const response = await axios.post(
      process.env.PAYMENT_STATUS_URL,
      payload,
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      }
    );

    return parseWaafiResponse(response.data);
  } catch (error) {
    console.error("❌ Payment status check error:", error.message);
    return {
      success: false,
      error: true,
      responseCode: "STATUS_CHECK_ERROR",
      responseMsg: error.message,
      userMessage: "Unable to check payment status",
    };
  }
};

/**
 * Test connection to WaafiPay API
 */
export const testConnection = async () => {
  try {
    validateEnvConfig();
    
    return {
      success: true,
      message: "Payment service configured correctly",
      configured: true,
      envVars: {
        PAYMENT_API_URL: process.env.PAYMENT_API_URL ? "✓ Configured" : "✗ Missing",
        MERCHANT_UID: process.env.MERCHANT_UID ? "✓ Configured" : "✗ Missing",
        API_USER_ID: process.env.API_USER_ID ? "✓ Configured" : "✗ Missing",
        API_KEY: process.env.API_KEY ? "✓ Configured" : "✗ Missing",
      },
    };
  } catch (error) {
    return {
      success: false,
      message: error.message,
      configured: false,
      envVars: {
        PAYMENT_API_URL: process.env.PAYMENT_API_URL ? "✓ Configured" : "✗ Missing",
        MERCHANT_UID: process.env.MERCHANT_UID ? "✓ Configured" : "✗ Missing",
        API_USER_ID: process.env.API_USER_ID ? "✓ Configured" : "✗ Missing",
        API_KEY: process.env.API_KEY ? "✓ Configured" : "✗ Missing",
      },
    };
  }
};

// Export constants for external use
export const PaymentConstants = {
  SUCCESS_CODES,
  PENDING_CODES,
  FAILURE_CODES,
  ERROR_MESSAGES,
};

export const PaymentHelpers = {
  normalizePhone,
  detectCarrier,
  generateRequestId,
  generateReferenceId,
  parseWaafiResponse,
};