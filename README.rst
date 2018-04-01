njtool - Tool for nature.com users
==================================

|version| |build| |dependency| |codacy| |maintainability| |test-coverage|

``njtool`` provides useful commands to operate on www.nature.com with
`Puppeteer`_.


USAGE
-----

A command below fetches PDF files of articles in "Nature Volume 555 Issue 7694",
and saves them into /journals/nature/2018-03-01_555_7694::

  $ njtool scrape nature:555:7694 | \
      njtool download -u your@email.address -p your_password -o /journals

Downloading multiple journals are supported::

  $ njtool scrape nature:555:7695 nature:555:7696 | \
      njtool download -u your@email.address -p your_password -o /journals

At this moment, ``njtool`` supports only Nature.  I have no plan to support
other journals.  Because I have no plan to subscribe others.

``njtool`` works fine on macOS.  It's recommended to use ``caffeinate`` in order
to prevent the system from sleeping when you run ``njtool download`` which
typically takes a long time.

``njtool`` works fine on Linux, but you may need to run commands with the
``--disable-sandbox`` option.  Probably, it also works on Windows, but I haven't
confirmed that yet.

See help for details of each command::

  $ njtool help


License
-------

This software is distributed under the MIT license.  See `LICENSE`_ file for
details.


.. |version| image::
   https://img.shields.io/npm/v/njtool.svg
   :target: https://www.npmjs.com/package/njtool
   :alt: Version
.. |build| image::
   https://travis-ci.org/masnagam/njtool.svg?branch=master
   :target: https://travis-ci.org/masnagam/njtool
   :alt: Build
.. |dependency| image::
   https://gemnasium.com/badges/github.com/masnagam/njtool.svg
   :target: https://gemnasium.com/github.com/masnagam/njtool
   :alt: Dependency
.. |codacy| image::
   https://api.codacy.com/project/badge/Grade/84d4bc5c66524277aa6a13a43a6395ef
   :target: https://www.codacy.com/app/masnagam/njtool?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=masnagam/njtool&amp;utm_campaign=Badge_Grade
   :alt: Codacy
.. |maintainability| image::
   https://api.codeclimate.com/v1/badges/520d222651cf6841a61d/maintainability
   :target: https://codeclimate.com/github/masnagam/njtool/maintainability
   :alt: Maintainability
.. |test-coverage| image::
   https://api.codeclimate.com/v1/badges/520d222651cf6841a61d/test_coverage
   :target: https://codeclimate.com/github/masnagam/njtool/test_coverage
   :alt: Test Coverage
.. _Puppeteer: https://github.com/GoogleChrome/puppeteer
.. _LICENSE: ./LICENSE
