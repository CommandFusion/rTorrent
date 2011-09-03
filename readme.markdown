# rTorrent Module for CommandFusion

## What is rTorrent?

rTorrent is a very efficient BitTorrent client for linux.  
It has a very small memory footprint, a very customizable configuration file, and exposes it’s internals through XML-RPC.

rTorrent will run on NAS devices such as QNAP models.  
See the [QNAP Forums](http://forum.qnap.com/viewtopic.php?f=146&t=45802) for more details

Here is a screenshot showing the ruTorrent Web GUI front end for rTorrent, using the Oblivion skin:
![ruTorrent Oblivion Skin (web GUI frontend for rTorrent)](https://github.com/CommandFusion/rTorrent/raw/master/Screenshots/rTorrent.png "ruTorrent web GUI")

## How do we communicate with rTorrent?

This module uses the XML-RPC protocol to communicate with rTorrent:  
[rTorrent XMLRPC Reference](http://code.google.com/p/gi-torrent/wiki/rTorrent_XMLRPC_reference)  
[More details](http://libtorrent.rakshasa.no/wiki/RTorrentCommands)

Communication is then sent via the SCGI protocol where rTorrent is listening.  
[SCGI Documentation](http://en.wikipedia.org/wiki/Simple_Common_Gateway_Interface)

Responses are returned in multiple packets, depending on the data length, appended and finally parsed as an XML Document.  
JavaScript can then handle all the data easily via it's built in [DOM methods](https://developer.mozilla.org/en/Gecko_DOM_Reference).

## TODO
* Add support for starting/stopping/pausing torrents
* Add support for removing torrents and/or their data
* Add support for adding new torrents via torrent URLs (not useful unless you interface with some RSS feed or something for getting the torrent URLs, but then it's best to let rTorrent parse the RSS feed automatically).