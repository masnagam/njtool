njtool
======

|dependency| |maintainability|

``njtool`` provides useful commands to operate on www.nature.com with
`Puppeteer`_.

See help for details of each command::

  $ njtool help

``njtool`` works fine on macOS at this moment.  It also works fine on Linux, but
you may need to run commands with the ``--disable-sandbox`` option.  Probably,
it also works on Windows, but I haven't confirmed that yet.


TODO
----

* Writing tests


License
-------

This software is distributed under the MIT license.  See `LICENSE`_ file for
details.


.. |dependency| image::
   https://gemnasium.com/badges/github.com/masnagam/njtool.svg
   :target: https://gemnasium.com/github.com/masnagam/njtool
   :alt: Dependency
.. |maintainability| image::
   https://api.codeclimate.com/v1/badges/520d222651cf6841a61d/maintainability
   :target: https://codeclimate.com/github/masnagam/njtool/maintainability
   :alt: Maintainability
.. _Puppeteer: https://github.com/GoogleChrome/puppeteer
.. _LICENSE: ./LICENSE
