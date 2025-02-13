import FalconApi from '@crowdstrike/foundry-js';

const falcon = new FalconApi();

(async () => {
  await falcon.connect();

  const customerIdInput = document.getElementById('customerId');
  const containmentOuInput = document.getElementById('containmentOu');
  const saveButton = document.getElementById('saveButton');
  const statusMessage = document.getElementById('statusMessage');
  const collection = falcon.collection({ collection: 'settings' });

  // Function to load existing settings
  async function loadSettings() {
    try {
      const settings = await collection.read('all');
      console.log('Loading settings:', settings);

      if (settings && Object.keys(settings).length > 0) {
        customerIdInput.value = settings.customer_id || '';
        containmentOuInput.value = settings.containment_ou || '';
        statusMessage.innerHTML = '<span class="text-blue">Existing settings loaded</span>';
      }
    } catch (error) {
      // At this point it's probably the first time, so we can just ignore and log it
      console.log('No settings found:', error);
      statusMessage.innerHTML = '<span class="text-blue">No existing settings found</span>';
    }
  }

  // Function to save settings
  async function saveSettings() {
    const customer_id = customerIdInput.value.trim();
    const containment_ou = containmentOuInput.value.trim();

    if (!customer_id || !containment_ou) {
      statusMessage.innerHTML = '<span class="text-critical">Please fill in all fields</span>';
      return;
    }

    try {
      const data = {
        "customer_id": customer_id,
        "containment_ou": containment_ou,
      };
      await collection.write('all', data);
      console.log('Settings saved:', data);

      statusMessage.innerHTML = '<span class="text-blue">Settings saved successfully!</span>';
    } catch (error) {
      statusMessage.innerHTML = `<span class="text-critical">Error saving settings: ${error.message}</span>`;
    }
  }

  // Add event listener for save button
  saveButton.addEventListener('click', saveSettings);

  // Load existing settings when the app starts
  await loadSettings();
})();
