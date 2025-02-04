import FalconApi from '@crowdstrike/foundry-js';

const falcon = new FalconApi();

(async () => {
  await falcon.connect();

  falcon.events.on('data', (data) => {
    // const myJson = JSON.stringify(data, null, 2);
    const dataDiv = document.getElementById('dataDiv');
    const titleDiv = document.getElementById('titleDiv');

    // Because we can accept data from 2 different data source, in order to ensure
    // we are working with the right platform, we need to check for platform_name from 2
    // places: data.detections.device.platform_name or data.platform_name
    const platformName = data.detection?.device?.platform_name || data.platform_name;
    const status = data.detection?.device?.status || data.status;

    if (platformName != 'ChromeOS') {
    titleDiv.innerHTML =
      '<h1 class="text-titles-and-attributes">This extension is only for ChromeOS Devices</h1>';
    } else {
      titleDiv.innerHTML =
        '<h1 class="text-titles-and-attributes">Disabled Status: ' + status + '</h1>';

      dataDiv.innerHTML =
        '<button id="toggleButton" class="focusable inline-flex items-center justify-center transition truncate type-md-medium rounded flex-1 interactive-normal px-4 py-1">Disable</button>';
      }
      // Add click event listener to the button
      document.getElementById('toggleButton').addEventListener('click', function() {
        const button = document.getElementById('toggleButton');
        button.textContent = button.textContent === 'Disable' ? 'Re-enable' : 'Disable';
      });

  })
})();
