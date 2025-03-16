import FalconApi from "@crowdstrike/foundry-js";

const falcon = new FalconApi();

(async () => {
  await falcon.connect();

  const customerIdInput = document.getElementById("customerId");
  const containmentOuInput = document.getElementById("containmentOu");
  const containmentOuDropdown = document.getElementById(
    "containmentOuDropdown"
  );
  const testConnectionButton = document.getElementById("testConnectionButton");
  const saveButton = document.getElementById("saveButton");
  const statusMessage = document.getElementById("statusMessage");
  const collection = falcon.collection({ collection: "settings" });

  // Helper function to set status message with Toucan CSS color classes
  function setStatus(message, type = "info") {
    // Remove any existing color classes
    statusMessage.className = "mt-4 text-sm";

    // Add appropriate Toucan CSS color class based on message type
    switch (type) {
      case "success":
        statusMessage.classList.add("text-positive");
        break;
      case "error":
        statusMessage.classList.add("text-critical");
        break;
      case "warning":
        statusMessage.classList.add("text-code-base-64");
        break;
      case "info":
      default:
        statusMessage.classList.add("text-blue");
    }

    statusMessage.textContent = message;
  }

  async function loadOrganizationalUnits(customerId) {
    if (!customerId) {
      setStatus("Please enter a Customer ID first", "warning");
      return false;
    }

    try {
      setStatus("Testing connection and loading OUs...", "info");

      const apiIntegration = falcon.apiIntegration({
        definitionId: "chromeos-api",
        operationId: "ChromeOS - List Organizational Units",
      });

      const response = await apiIntegration.execute({
        request: {
          params: {
            path: {
              customerId: customerId,
            },
            query: {
              type: "allIncludingParent",
            },
          },
        },
      });

      console.log("API Response:", response);

      // Check for successful response
      if (response?.resources?.[0]?.status_code === 200) {
        // The response_body is already an object, no need to parse it
        const responseBody = response.resources[0].response_body;
        const organizationUnits = responseBody?.organizationUnits || [];

        if (organizationUnits.length > 0) {
          containmentOuDropdown.innerHTML =
            '<option value="">Select an Organizational Unit</option>';

          // Add options to dropdown
          organizationUnits.forEach((ou) => {
            const option = document.createElement("option");
            option.value = ou.orgUnitPath;
            option.textContent = `${ou.name} (${ou.orgUnitPath})`;
            containmentOuDropdown.appendChild(option);
          });

          containmentOuDropdown.style.display = "block";
          containmentOuInput.style.display = "none";

          setStatus(
            `Found ${organizationUnits.length} organizational units. Please select one.`,
            "success"
          );
          return true;
        } else {
          setStatus(
            "No organizational units found. Please enter OU path manually.",
            "warning"
          );
        }
      } else {
        // Handle non-200 status code
        const errorMsg =
          response?.resources?.[0]?.response_body?.error?.message ||
          "Unknown error occurred while fetching organizational units";
        setStatus(`API Error: ${errorMsg}`, "error");
      }

      return false;
    } catch (error) {
      console.error("Error loading OUs:", error);
      setStatus(
        `Connection failed: ${error.message}. Please check your Customer ID.`,
        "error"
      );
      containmentOuInput.style.display = "block";
      containmentOuDropdown.style.display = "none";
      return false;
    }
  }

  async function loadSettings() {
    try {
      const settings = await collection.read("all");

      if (settings?.customer_id?.length > 0) {
        customerIdInput.value = settings.customer_id;

        if (settings?.containment_ou?.length > 0) {
          containmentOuInput.value = settings.containment_ou;
        }

        setStatus(
          'Existing settings loaded. Click "Test Connection" to load organizational units.',
          "info"
        );
      } else {
        setStatus("Please configure your settings", "info");
      }
    } catch (error) {
      console.log("No settings found:", error);
      setStatus("Please configure your settings", "info");
    }
  }

  async function saveSettings() {
    const customer_id = customerIdInput.value.trim();
    const containment_ou =
      containmentOuDropdown.style.display !== "none" &&
      containmentOuDropdown.value
        ? containmentOuDropdown.value
        : containmentOuInput.value.trim();

    if (!customer_id || !containment_ou) {
      setStatus("Please fill in all fields", "error");
      return;
    }

    try {
      const data = {
        customer_id: customer_id,
        containment_ou: containment_ou,
      };
      await collection.write("all", data);

      setStatus("Settings saved successfully!", "success");
    } catch (error) {
      setStatus(`Error saving settings: ${error.message}`, "error");
    }
  }

  testConnectionButton.addEventListener("click", async () => {
    const customerId = customerIdInput.value.trim();
    await loadOrganizationalUnits(customerId);
  });

  saveButton.addEventListener("click", saveSettings);

  await loadSettings();
})();
