import FalconApi from "@crowdstrike/foundry-js";

const falcon = new FalconApi();

async function loadSettings() {
  try {
    console.log("Attempting to read settings...");
    const settings = await falcon
      .collection({ collection: "settings" })
      .read("all");
    console.log("Settings read complete:", settings);
    if (!settings || !settings.customer_id) {
      throw new Error("No customer ID configured");
    }
    return settings;
  } catch (error) {
    console.error("Error loading settings:", error);
    throw error;
  }
}

function updateUI(titleText, content, isError = false) {
  const titleDiv = document.getElementById("titleDiv");
  const dataDiv = document.getElementById("dataDiv");

  titleDiv.innerHTML = `<h1 class="text-titles-and-attributes">${titleText}</h1>`;
  dataDiv.innerHTML = content;

  if (isError) {
    dataDiv.classList.add("text-critical");
  }
}

function convertDeviceId(deviceId) {
  // Add hyphens to the hex string to make it UUID formatted for ChromeOS
  return deviceId.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
}

async function getDeviceStatus(deviceId, customer_id) {
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
            customerId: customer_id,
            deviceId: formattedDeviceId,
          },
        },
      },
    });

    if (response.resources?.[0]?.status_code === 200) {
      // return the status
      console.log(
        "Device status response:",
        response.resources[0].response_body
      );
      return response.resources[0].response_body.status;
    }
  } catch (error) {
    console.error("Error getting device status:", error);
    throw error;
  }
}

async function handleDeviceAction(action, deviceId, customer_id) {
  console.log(`Handling device action: ${action} for device: ${deviceId}`);
  try {
    const deviceActions = {
      disable: "CHANGE_CHROME_OS_DEVICE_STATUS_ACTION_DISABLE",
      enable: "CHANGE_CHROME_OS_DEVICE_STATUS_ACTION_REENABLE",
    };
    const formattedDeviceId = convertDeviceId(deviceId);
    const changeStatus = falcon.apiIntegration({
      definitionId: "chromeos-api",
      operationId: "ChromeOS - Change Device Status",
    });

    await changeStatus.execute({
      request: {
        params: {
          path: {
            customer_id: customer_id,
          },
        },
        json: {
          changeChromeOsDeviceStatusAction: deviceActions[action],
          deviceIds: [formattedDeviceId],
        },
      },
    });
    return true;
  } catch (error) {
    console.error(`Error performing ${action} action:`, error);
    throw error;
  }
}

function setupToggleButton(deviceId, customer_id, initialStatus) {
  const titleDiv = document.getElementById("titleDiv");
  const button = document.getElementById("toggleButton");
  if (!button) return;

  // Initial setup of button text
  updateButtonState(initialStatus);

  async function handleClick() {
    try {
      const currentStatus = await getDeviceStatus(deviceId, customer_id);
      const action = currentStatus === "DISABLED" ? "enable" : "disable";

      // Show loading state
      button.disabled = true;
      button.innerHTML = `<span class="spinner"></span> ${
        action === "disable" ? "Disabling" : "Enabling"
      }...`;

      await handleDeviceAction(action, deviceId, customer_id);

      // Get the new status after the action
      const newStatus = await getDeviceStatus(deviceId, customer_id);

      // Update UI elements
      updateButtonState(newStatus);
      titleDiv.innerHTML = `<h1 class="text-titles-and-attributes">Device Status: ${
        newStatus === "DISABLED" ? "Disabled" : "Provisioned"
      }</h1>`;
    } catch (error) {
      console.error("Error updating device status:", error);
      titleDiv.innerHTML = `<h1 class="text-titles-and-attributes">Error</h1>`;
      button.textContent = "Error";
      button.classList.add("text-critical");
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

async function handleDeviceData(data, customer_id) {
  const platformName =
    data.detection?.device?.platform_name || data.platform_name;
  const deviceId = data.detection?.device?.device_id || data.device_id;

  // Check platform first before making any API calls
  if (platformName !== "ChromeOS") {
    updateUI(
      "Invalid Device",
      "This extension is only for ChromeOS Devices",
      true
    );
    return;
  }

  try {
    // Await the status call
    const status = await getDeviceStatus(deviceId, customer_id);
    const isDisabled = status === "DISABLED";

    updateUI(
      // Status from the API should match what a user sees in the admin console:
      // Disabled, Provisioned
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

    setupToggleButton(deviceId, customer_id, status);
  } catch (error) {
    console.error("Error getting device status:", error);
    updateUI("Error", "Failed to get device status: " + error.message, true);
  }
}

(async () => {
  try {
    console.log("Starting setup...");
    await falcon.connect();
    console.log("Falcon connected");

    // Set up event listener first
    console.log("Setting up event listener...");
    falcon.events.on("data", async (data) => {
      try {
        console.log("Received data:", data);
        // Load settings when we actually need them
        const settings = await loadSettings();
        handleDeviceData(data, settings.customer_id);
      } catch (error) {
        console.error("Error handling data:", error);
        updateUI(
          "Configuration Error",
          "Failed to load settings: " + error.message,
          true
        );
      }
    });

    console.log("Event listener setup complete");
  } catch (error) {
    console.error("Setup error:", error);
    updateUI(
      "Configuration Required",
      "Please complete the configuration in the Custom apps -> ChromeOS Settings page first",
      true
    );
  }
})();
