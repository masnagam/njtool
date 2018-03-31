// This file is distributed under the MIT license.
// See LICENSE file in the project root for details.

'use strict';

// istanbul ignore next
function sleep(sec) {
  return new Promise((resolve) => setTimeout(resolve, sec * 1000));
}

module.exports = sleep;
