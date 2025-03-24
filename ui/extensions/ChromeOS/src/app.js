import FalconApi from "@crowdstrike/foundry-js";

const falcon = new FalconApi();

// Simple centralized error messages
const ErrorMessages = {
  // HTTP Status Codes
  400: "Bad request. Please check the format of your request.",
  401: "Authentication failed. Please check your credentials.",
  403: "You don't have permission to access this resource.",
  404: "Resource not found. The device may not exist in Google Workspace or you may not have access to it.",
  429: "Too many requests. Please try again later.",
  500: "Server error. Please try again later.",
  502: "Bad gateway. The server received an invalid response.",
  503: "Service unavailable. Please try again later.",
  504: "Gateway timeout. The server didn't respond in time.",

  // Application-specific errors
  NOT_CHROME_OS: "This extension only works with ChromeOS devices.",
  NETWORK_ERROR:
    "Network error: Unable to connect to the ChromeOS API. Please check your connection.",
  TIMEOUT_ERROR: "Connection timed out. Please try again later.",
  INITIALIZATION_ERROR: "Failed to initialize the extension.",
  NO_DEVICE_DATA: "No device data received.",
  NO_DEVICE_ID: "No device ID found in the provided data.",
  INVALID_ACTION: "Invalid device action requested.",
  ACTION_FAILED: "Failed to perform the requested action on the device.",
  UNKNOWN_ERROR: "An unexpected error occurred. Please try again.",
};

function getErrorMessage(error) {
  // Get status code from error response
  const statusCode =
    error.statusCode || (error.resources && error.resources[0]?.status_code);

  if (statusCode && ErrorMessages[statusCode]) {
    return ErrorMessages[statusCode];
  }

  if (error.code && ErrorMessages[error.code]) {
    return ErrorMessages[error.code];
  }

  return error.message || ErrorMessages.UNKNOWN_ERROR;
}

function updateUI(titleText, content, isError = false) {
  const titleDiv = document.getElementById("titleDiv");
  const dataDiv = document.getElementById("dataDiv");

  titleDiv.innerHTML = `<h1 class="text-titles-and-attributes">${titleText}</h1>`;
  dataDiv.innerHTML = content;

  if (isError) {
    dataDiv.classList.add("text-critical");
  } else {
    dataDiv.classList.remove("text-critical");
  }
}

function convertDeviceId(deviceId) {
  // Add hyphens to the hex string to make it UUID formatted for ChromeOS
  return deviceId.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
}

async function getDeviceStatus(deviceId) {
  try {
    const formattedDeviceId = convertDeviceId(deviceId);
    const getDeviceInfo = falcon.apiIntegration({
      definitionId: "chromeos-api",
      operationId: "ChromeOS - Get Device Info",
    });

    const response = await getDeviceInfo.execute({
      request: {
        params: {
          path: {
            deviceId: formattedDeviceId,
          },
        },
      },
    });

    console.log("Device status response:", response);

    if (response.resources?.[0]?.status_code === 200) {
      return response.resources[0].response_body.status;
    } else {
      const statusCode = response.resources?.[0]?.status_code || "unknown";
      const error = new Error();
      error.statusCode = statusCode;
      throw error;
    }
  } catch (error) {
    console.error("Error getting device status:", error);

    // If it doesn't have a status code yet, check for network errors
    if (!error.statusCode) {
      if (error.message && error.message.includes("network")) {
        error.code = "NETWORK_ERROR";
      }
    }

    throw error;
  }
}

async function handleDeviceAction(action, deviceId) {
  console.log(`Handling device action: ${action} for device: ${deviceId}`);
  try {
    const deviceActions = {
      disable: "CHANGE_CHROME_OS_DEVICE_STATUS_ACTION_DISABLE",
      enable: "CHANGE_CHROME_OS_DEVICE_STATUS_ACTION_REENABLE",
    };

    if (!deviceActions[action]) {
      const error = new Error();
      error.code = "INVALID_ACTION";
      throw error;
    }

    const formattedDeviceId = convertDeviceId(deviceId);
    const changeStatus = falcon.apiIntegration({
      definitionId: "chromeos-api",
      operationId: "ChromeOS - Change Device Status",
    });

    const response = await changeStatus.execute({
      request: {
        json: {
          changeChromeOsDeviceStatusAction: deviceActions[action],
          deviceIds: [formattedDeviceId],
        },
      },
    });

    // Check response status
    const statusCode = response.resources?.[0]?.status_code;
    if (!statusCode || statusCode < 200 || statusCode >= 300) {
      const error = new Error();
      error.statusCode = statusCode;
      error.code = "ACTION_FAILED";
      throw error;
    }

    return true;
  } catch (error) {
    console.error(`Error performing ${action} action:`, error);

    // If no statusCode or code is set, use ACTION_FAILED
    if (!error.statusCode && !error.code) {
      error.code = "ACTION_FAILED";
    }

    throw error;
  }
}

function setupToggleButton(deviceId, initialStatus) {
  const titleDiv = document.getElementById("titleDiv");
  const button = document.getElementById("toggleButton");
  if (!button) return;

  // Initial setup of button text
  updateButtonState(initialStatus);

  async function handleClick() {
    try {
      const currentStatus = await getDeviceStatus(deviceId);
      const action = currentStatus === "DISABLED" ? "enable" : "disable";

      // Show loading state
      button.disabled = true;
      button.innerHTML = `<span class="spinner"></span> ${
        action === "disable" ? "Disabling" : "Enabling"
      }...`;

      await handleDeviceAction(action, deviceId);

      // Get the new status after the action
      const newStatus = await getDeviceStatus(deviceId);

      // Update UI elements
      updateButtonState(newStatus);
      titleDiv.innerHTML = `<h1 class="text-titles-and-attributes">Device Status: ${
        newStatus === "DISABLED" ? "Disabled" : "Provisioned"
      }</h1>`;
    } catch (error) {
      console.error("Error updating device status:", error);

      titleDiv.innerHTML = `<h1 class="text-titles-and-attributes">Action Failed</h1>`;
      button.textContent = "Try Again";
      button.classList.add("text-critical");

      // Display error message
      updateUI("Error", getErrorMessage(error), true);
    } finally {
      button.disabled = false;
    }
  }

  function updateButtonState(status) {
    const isDisabled = status === "DISABLED";
    button.textContent = isDisabled ? "Re-enable" : "Disable";
    button.disabled = false;
    button.classList.remove("text-critical");

    // Add tooltip text based on current state
    button.title = isDisabled
      ? "Re-enable this ChromeOS device in the Google Admin Console"
      : "Disable this ChromeOS device in the Google Admin Console";
  }

  button.addEventListener("click", handleClick);
}

async function handleDeviceData(data) {
  if (!data) {
    const error = new Error();
    error.code = "NO_DEVICE_DATA";
    updateUI("Error", getErrorMessage(error), true);
    return;
  }

  const platformName =
    data.detection?.device?.platform_name || data.platform_name;
  const deviceId = data.detection?.device?.device_id || data.device_id;

  if (!deviceId) {
    const error = new Error();
    error.code = "NO_DEVICE_ID";
    updateUI("Error", getErrorMessage(error), true);
    return;
  }

  // Check platform first before making any API calls
  if (platformName !== "ChromeOS") {
    const error = new Error();
    error.code = "NOT_CHROME_OS";
    updateUI(
      "Incompatible Device",
      `${getErrorMessage(error)} This device is running ${
        platformName || "an unknown platform"
      }.`,
      true
    );
    return;
  }

  try {
    // Await the status call
    const status = await getDeviceStatus(deviceId);
    const isDisabled = status === "DISABLED";

    updateUI(
      `Device Status: ${isDisabled ? "Disabled" : "Provisioned"}`,
      `<button id="toggleButton" class="focusable inline-flex items-center justify-center transition truncate type-md-medium rounded flex-1 interactive-normal px-4 py-1"
          title="${
            isDisabled
              ? "Re-enable this ChromeOS device in the Google Admin Console"
              : "Disable this ChromeOS device in the Google Admin Console"
          }">
        ${isDisabled ? "Re-enable" : "Disable"}
      </button>`
    );

    setupToggleButton(deviceId, status);
  } catch (error) {
    console.error("Error getting device status:", error);
    updateUI("Error", getErrorMessage(error), true);
  }
}

(async () => {
  try {
    console.log("Starting setup...");

    // Add timeout to connection attempt
    const connectionPromise = falcon.connect();
    const timeoutPromise = new Promise((_, reject) => {
      const error = new Error();
      error.code = "TIMEOUT_ERROR";
      setTimeout(() => reject(error), 10000);
    });

    await Promise.race([connectionPromise, timeoutPromise]);
    console.log("Falcon connected");

    // Set up event listener first
    console.log("Setting up event listener...");
    falcon.events.on("data", async (data) => {
      try {
        console.log("Received data:", data);
        handleDeviceData(data);
      } catch (error) {
        console.error("Error handling data:", error);
        updateUI("Error", getErrorMessage(error), true);
      }
    });

    console.log("Event listener setup complete");
  } catch (error) {
    console.error("Setup error:", error);

    if (!error.code) {
      error.code = "INITIALIZATION_ERROR";
    }

    updateUI("Configuration Error", getErrorMessage(error), true);
  }
})();
