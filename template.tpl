___TERMS_OF_SERVICE___

By creating or modifying this file you agree to Google Tag Manager's Community
Template Gallery Developer Terms of Service available at
https://developers.google.com/tag-manager/gallery-tos (or such other URL as
Google may provide), as modified from time to time.


___INFO___

{
  "type": "TAG",
  "id": "cvt_civic_bryn_pixel",
  "version": 1,
  "displayName": "Civic Bryn Pixel",
  "categories": [
    "ANALYTICS",
    "PERSONALIZATION"
  ],
  "brand": {
    "id": "github.com_civicteam",
    "displayName": "Civic"
  },
  "description": "The Civic Bryn pixel sends a privacy-conscious page-view signal (page URL, referrer and timestamp) to Civic Bryn so you can recognise high-intent visitors and personalise their experience. Enter your Civic Bryn Pixel ID and the tag loads the official Civic Bryn pixel for you. If your pages include Civic Bryn personalization slots, the pixel also upgrades them in-session.",
  "containerContexts": [
    "WEB"
  ],
  "securityGroups": []
}


___TEMPLATE_PARAMETERS___

[
  {
    "type": "TEXT",
    "name": "pixelRef",
    "displayName": "Civic Bryn Pixel ID",
    "simpleValueType": true,
    "help": "Your Civic Bryn Pixel ID. You can find it in the Civic Bryn console under the website integration settings for your account.",
    "valueValidators": [
      {
        "type": "NON_EMPTY",
        "errorMessage": "Enter your Civic Pixel ID."
      }
    ]
  },
  {
    "type": "GROUP",
    "name": "advanced",
    "displayName": "Advanced settings",
    "groupStyle": "ZIPPY_CLOSED",
    "subParams": [
      {
        "type": "TEXT",
        "name": "endpoint",
        "displayName": "Endpoint override",
        "simpleValueType": true,
        "help": "Advanced. Leave blank to use the default Civic ingest endpoint. Set this only if Civic has given you a custom endpoint base URL.",
        "valueHint": "https://bryn.civic.com/pixel"
      }
    ]
  }
]


___SANDBOXED_JS_FOR_WEB_TEMPLATE___

// Civic Bryn Pixel — loads the official Civic Bryn pixel and hands it the
// visitor's Civic Bryn Pixel ID through a first-party config global. The pixel
// itself posts the page-view beacon and (when the page has personalization
// slots) runs the in-session upgrade. Both happen in the page, outside this
// sandbox.
const injectScript = require('injectScript');
const setInWindow = require('setInWindow');
const queryPermission = require('queryPermission');
const makeString = require('makeString');

const SCRIPT_URL = 'https://bryn.civic.com/pixel/pixel.js';
const CONFIG_GLOBAL = '__brynPixel';

const config = { ref: makeString(data.pixelRef) };
if (data.endpoint) {
  config.endpoint = makeString(data.endpoint);
}

const onSuccess = () => {
  data.gtmOnSuccess();
};

const onFailure = () => {
  data.gtmOnFailure();
};

if (
  queryPermission('access_globals', 'write', CONFIG_GLOBAL) &&
  queryPermission('inject_script', SCRIPT_URL)
) {
  // Publish config before the pixel loads so it is present when the script runs.
  setInWindow(CONFIG_GLOBAL, config, true);
  // cacheToken (4th arg) dedupes the injected <script> within a page document.
  injectScript(SCRIPT_URL, onSuccess, onFailure, SCRIPT_URL);
} else {
  data.gtmOnFailure();
}


___WEB_PERMISSIONS___

[
  {
    "instance": {
      "key": {
        "publicId": "inject_script",
        "versionId": "1"
      },
      "param": [
        {
          "key": "urls",
          "value": {
            "type": 2,
            "listItem": [
              {
                "type": 1,
                "string": "https://bryn.civic.com/*"
              }
            ]
          }
        }
      ]
    },
    "clientAnnotations": {
      "isEditedByUser": true
    },
    "isRequired": true
  },
  {
    "instance": {
      "key": {
        "publicId": "access_globals",
        "versionId": "1"
      },
      "param": [
        {
          "key": "keys",
          "value": {
            "type": 2,
            "listItem": [
              {
                "type": 3,
                "mapKey": [
                  {
                    "type": 1,
                    "string": "key"
                  },
                  {
                    "type": 1,
                    "string": "read"
                  },
                  {
                    "type": 1,
                    "string": "write"
                  },
                  {
                    "type": 1,
                    "string": "execute"
                  }
                ],
                "mapValue": [
                  {
                    "type": 1,
                    "string": "__brynPixel"
                  },
                  {
                    "type": 8,
                    "boolean": false
                  },
                  {
                    "type": 8,
                    "boolean": true
                  },
                  {
                    "type": 8,
                    "boolean": false
                  }
                ]
              }
            ]
          }
        }
      ]
    },
    "clientAnnotations": {
      "isEditedByUser": true
    },
    "isRequired": true
  }
]


___TESTS___

scenarios:
- name: Injects the pixel and publishes the ref to the config global
  code: |-
    const mockData = { pixelRef: 'abc123' };
    let injectedUrl;
    mock('injectScript', (url, onSuccess) => {
      injectedUrl = url;
      onSuccess();
    });
    mock('setInWindow', (key, value, overrideExisting) => true);

    runCode(mockData);

    assertApi('setInWindow').wasCalledWith('__brynPixel', { ref: 'abc123' }, true);
    assertThat(injectedUrl).isEqualTo('https://bryn.civic.com/pixel/pixel.js');
    assertApi('gtmOnSuccess').wasCalled();
- name: Includes the endpoint override when provided
  code: |-
    const mockData = { pixelRef: 'abc123', endpoint: 'https://bryn.civic.com/pixel' };
    let publishedValue;
    mock('setInWindow', (key, value, overrideExisting) => {
      publishedValue = value;
      return true;
    });
    mock('injectScript', (url, onSuccess) => {
      onSuccess();
    });

    runCode(mockData);

    assertThat(publishedValue).isEqualTo({ ref: 'abc123', endpoint: 'https://bryn.civic.com/pixel' });
- name: Fails gracefully when permissions are denied
  code: |-
    const mockData = { pixelRef: 'abc123' };
    mock('queryPermission', () => false);
    let injected = false;
    mock('injectScript', (url, onSuccess) => {
      injected = true;
    });

    runCode(mockData);

    assertThat(injected).isEqualTo(false);
    assertApi('gtmOnFailure').wasCalled();
- name: Calls gtmOnFailure when the pixel script fails to load
  code: |-
    const mockData = { pixelRef: 'abc123' };
    mock('injectScript', (url, onSuccess, onFailure) => {
      onFailure();
    });
    mock('setInWindow', (key, value, overrideExisting) => true);

    runCode(mockData);

    assertApi('gtmOnFailure').wasCalled();


___NOTES___

The Civic Bryn Pixel tag loads the official Civic Bryn pixel from
https://bryn.civic.com/pixel/pixel.js and passes the Civic Bryn Pixel ID via the
first-party window.__brynPixel config object. The pixel posts the page-view
beacon and runs in-session personalization from the page itself.
