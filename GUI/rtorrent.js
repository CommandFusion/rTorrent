/* rTorrent module for CommandFusion
===============================================================================

AUTHOR:		Jarrod Bell, CommandFusion
CONTACT:	support@commandfusion.com
URL:		https://github.com/CommandFusion/rTorrent
VERSION:	v1.0.0
LAST MOD:	Saturday, 3 September 2011

=========================================================================
HELP:

Priorities:
Off		= 0
Low		= 1
Normal	= 2
High	= 3

=========================================================================
*/

function round(n,dec) {
	n = parseFloat(n);
	if(!isNaN(n)){
		if(!dec) var dec= 0;
		var factor= Math.pow(10,dec);
		return Math.floor(n*factor+((n*factor*10)%10>=5?1:0))/factor;
	}else{
		return n;
	}
}

// ======================================================================
// Global Object
// ======================================================================

var CFrTorrent = function (params) {
	var self = {
		address:		"",
		port:			0,
		systemName:		"",
		feedbackName:	"",
		torrents:		[],
		lastRequest:	"",
		incomingData:	"",
		listJoin:		"",
		lastItem:		0,
		sounds:			{
			selectTorrent:	"d50",
			click:			"d51",
			alert:			"d52",
		},
		states:			[
			"Unknown",
			"Seeding",
			"Leeching",
			"Checking",
			"Stopped",
			"Paused"
		]
	};

	var Torrent = function() {
		this.hash = "";				// Unique Hash of the torrent, used for torrent actions
		this.name = "";				// Name of the torrent
		this.state = 0;				// 0 = Paused, 1 = ?
		this.bytesCompleted = 0;	// Bytes that have been downloaded so far
		this.bytesTotal = 0;		// Total bytes for the torrent
		this.bytesRemaining = 0;	// Bytes yet to be downloaded
		this.mb = 0;				// Bytes in MB
		this.downRate = 0;			// The download rate in kb/sec for the torrent
		this.upRate = 0;			// The upload rate in kb/sec for the torrent
		this.peersConnected = 0;
		this.peersNotConnected = 0;
		this.peersAccounted = 0;
		this.bytesDone = 0;
		this.upTotal = 0;			// Total bytes uploaded
		this.creationDate = 0;		// Date the torrent was created
		this.isComplete = 0;		// 0 = incomplete, 1 = complete
		this.ratio = 0;				// Download to Upload ratio for the torrent
		this.isActive = 0;			// 0 = inactive, 1 = active
	};

	// Check if the torrent exists in the torrents array (each torrent has a unique hash)
	self.getTorrent = function (hash) {
		for (var i = 0, t; t = self.torrents[i]; i++) {
			if (t.hash === hash) {
				return t;
			}
		}  
		return null;
	};

	// Sort torrents by their status, then their name
	self.sortTorrents = function (a,b) {
		if (a.isComplete < b.isComplete) {
			return -1;
		} else if (a.isComplete > b.isComplete) {
			return 1;
		} else {
			if (a.state < b.state) {
				return -1;
			} else if (a.state == b.state) {
				return a.name.localeCompare(b.name);
			}
		}
		return 1;
	};

	self.updateList = function () {
		// First clear the list
		CF.listRemove(self.listJoin);
		// Sort torrents by status, then name
		self.torrents.sort(self.sortTorrents);
		// Add each item to the list
		var currentState = 0;
		var currentCompleted = false;
		for (var i = 0, t; t = self.torrents[i]; i++) {
			if (t.isComplete && !currentCompleted) {
				// Insert title for completed items
				CF.listAdd(self.listJoin, [{title: true, "s1": "Completed"}]);
				currentCompleted = true;
			} else if (currentState != t.state) {
				// Insert title for new state
				currentState = t.state;
				CF.listAdd(self.listJoin, [{title: true, "s1": self.states[currentState]}]);
			}

			CF.listAdd(self.listJoin, [{"s1": t.name, "a1": (65535/t.bytesTotal)*t.bytesCompleted, "s2": round((100/t.bytesTotal)*t.bytesCompleted, 1) + "%",
				"d1": {
					tokens: {
						"hash": t.hash // Add the hash as a token so we can perform actions on the torrent later
					}
				}
			}]);
			// Hide the item notch
			CF.setProperties({join: self.listJoin+":"+i+":s99", y: 60, h: 0});
		}
	};

	// Select a torrent from the list and show/hide its options
	self.selectTorrent = function (listIndex) {
		// Get token stored in the list item to see if its expanded already or not
		CF.getJoin(self.listJoin+":"+listIndex+":d1", function (j,v,t) {
			if (t["expanded"] == 1) {
				// Hide the item notch
				CF.setProperties({join: self.listJoin+":"+listIndex+":s99", y: 60, h: 0}, 0, 0.2);
				// Remove expanded list item for the selected torrent
				CF.listRemove(self.listJoin, listIndex + 1, 1);
				CF.setToken(j, "expanded", 0);
			} else {
				// Show the item notch
				CF.setProperties({join: self.listJoin+":"+listIndex+":s99", y: 48, h: 12}, 0, 0.2);
				// Insert a new list item with options for the selected torrent
				CF.listAdd(self.listJoin, [{subpage: "list_torrent_actions"}], listIndex + 1);
				CF.setToken(j, "expanded", 1);
				// Make sure both the selected item and the options item are fully visible
				CF.listScroll(self.listJoin, listIndex + 1, CF.VisiblePosition, true, true);
				CF.listScroll(self.listJoin, listIndex, CF.VisiblePosition, true, true);
			}
		});
		CF.setJoin(self.sounds.selectTorrent, 1);
	};

	self.startTorrent = function(listIndex) {
		if (listIndex === undefined) {
			listIndex = self.lastItem;
		}
		if (listIndex <= 0) {
			return;
		}
		// Get the torrent hash from the list item above
		CF.getJoin(self.listJoin+":"+(listIndex-1)+":d1", function (j,v,t) {
			self.doTorrentAction("d.start", t["hash"]);
		});
	};

	self.pauseTorrent = function(listIndex) {
		if (listIndex === undefined) {
			listIndex = self.lastItem;
		}
		if (listIndex <= 0) {
			return;
		}
		// Get the torrent hash from the list item above
		CF.getJoin(self.listJoin+":"+(listIndex-1)+":d1", function (j,v,t) {
			self.doTorrentAction("d.pause", t["hash"]);
		});
	};

	// Recheck the torrent hash
	self.recheckTorrent = function(listIndex) {
		if (listIndex === undefined) {
			listIndex = self.lastItem;
		}
		if (listIndex <= 0) {
			return;
		}
		// Get the torrent hash from the list item above
		CF.getJoin(self.listJoin+":"+(listIndex-1)+":d1", function (j,v,t) {
			self.doTorrentAction("d.check_hash", t["hash"]);
		});
	};

	// Just remove the torrent from the list (keep the files)
	self.removeTorrent = function(listIndex) {
		if (listIndex === undefined) {
			listIndex = self.lastItem;
		}
		if (listIndex <= 0) {
			return;
		}
		// Get the torrent hash from the list item above
		CF.getJoin(self.listJoin+":"+(listIndex-1)+":d1", function (j,v,t) {
			self.doTorrentAction("d.erase", t["hash"]);
			self.selectTorrent(listIndex-1);
			self.torrents.pop(self.getTorrent(t["hash"]));
			self.updateList();
		});
	};

	// Note this will remove the torrent and delete all files associated with it, including the downloaded data!
	self.eraseTorrent = function(listIndex) {
		if (listIndex === undefined) {
			listIndex = self.lastItem;
		}
		// Get the torrent hash from the list item above
		CF.getJoin(self.listJoin+":"+(listIndex-1)+":d1", function (j,v,t) {
			self.doTorrentAction("d.delete_tied", t["hash"]);
			self.selectTorrent(listIndex-1);
			self.torrents.pop(self.getTorrent(t["hash"]));
			self.updateList();
		});
	};

	self.doTorrentAction = function (action, hash) {
		var msg = new XMLRPCMessage(action);
		msg.addParameter(hash);

		self.buildSCGI(msg.xml(), "recheckTorrent");
	};

	// Load in some fake torrent data for testing offline
	self.fakeTorrents = function () {
		self.torrents = [];
		var newTorrent = new Torrent();
		newTorrent.name = "Fake Torrent 1";
		newTorrent.bytesCompleted = 50;
		newTorrent.bytesTotal = 100;
		newTorrent.hash = "AAAAA";
		self.torrents.push(newTorrent);

		newTorrent = new Torrent();
		newTorrent.name = "This is a really long torrent name that will split across at least 2 lines";
		newTorrent.bytesCompleted = 100;
		newTorrent.bytesTotal = 100;
		newTorrent.isComplete = 1;
		newTorrent.hash = "BBBBBB";
		self.torrents.push(newTorrent);

		newTorrent = new Torrent();
		newTorrent.name = "Another fake torrent for good measure";
		newTorrent.bytesCompleted = 10;
		newTorrent.bytesTotal = 100;
		newTorrent.hash = "CCCCCC";
		self.torrents.push(newTorrent);

		newTorrent = new Torrent();
		newTorrent.name = "This is a torrent";
		newTorrent.bytesCompleted = 20;
		newTorrent.bytesTotal = 100;
		newTorrent.hash = "DDDDDD";
		self.torrents.push(newTorrent);

		newTorrent = new Torrent();
		newTorrent.name = "This is another torrent";
		newTorrent.bytesCompleted = 70;
		newTorrent.bytesTotal = 100;
		newTorrent.hash = "EEEEEE";
		self.torrents.push(newTorrent);

		newTorrent = new Torrent();
		newTorrent.name = "What? Another one?!?";
		newTorrent.bytesCompleted = 0;
		newTorrent.bytesTotal = 100;
		newTorrent.hash = "FFFFFF";
		self.torrents.push(newTorrent);

		newTorrent = new Torrent();
		newTorrent.name = "Last one, phew!";
		newTorrent.bytesCompleted = 100;
		newTorrent.bytesTotal = 100;
		newTorrent.isComplete = 1;
		newTorrent.hash = "GGGGGG";
		self.torrents.push(newTorrent);

		self.updateList();
	};

	self.onIncomingData = function (theSystem, matchedString) {
		//CF.log("RECIEVED: " + matchedString);

		// Data can come in on multiple responses, so append until we get the full XML reply
		self.incomingData += matchedString;

		var xmlRegex = /.*(<\?xml version[\s\S]+<\/methodResponse>)/i; // Regular expression to grab just the XML from the response data
		var matches = xmlRegex.exec(self.incomingData) || []; // Return empty array of matches if the data is not a full XML document yet
		if (matches.length > 0) {
			self.incomingData = "";
			// matches[1] == XML Data to convert into XML parsable object
			var parser = new DOMParser();
			var xmlDoc = parser.parseFromString(matches[1],"text/xml");

			if (self.lastRequest == "listTorrents") {
				var torrentNodes = xmlDoc.getElementsByTagName("data");
				var aTorrent = null;
				for (var i = 1; i<torrentNodes.length; i++) {
					var hash = torrentNodes[i].getElementsByTagName("string")[0].childNodes[0].nodeValue;
					// Check if this torrent has already been stored in our array (hash is unique for each)
					aTorrent = self.getTorrent(hash);
					if (aTorrent === null) {
						// Torrent not found, create a new one and add it to the torrents array
						aTorrent = new Torrent();
						aTorrent.hash = hash;
						self.torrents.push(aTorrent);
					}
					aTorrent.name				= torrentNodes[i].getElementsByTagName("string")[1].childNodes[0].nodeValue;
					aTorrent.state				= torrentNodes[i].getElementsByTagName("i8")[0].childNodes[0].nodeValue;
					aTorrent.bytesCompleted		= torrentNodes[i].getElementsByTagName("i8")[1].childNodes[0].nodeValue;
					aTorrent.bytesTotal			= torrentNodes[i].getElementsByTagName("i8")[2].childNodes[0].nodeValue;
					aTorrent.bytesRemain		= torrentNodes[i].getElementsByTagName("i8")[3].childNodes[0].nodeValue;
					aTorrent.mb					= aTorrent.BytesTotal/1024/1024;
					aTorrent.downRate			= torrentNodes[i].getElementsByTagName("i8")[4].childNodes[0].nodeValue;
					aTorrent.upRate				= torrentNodes[i].getElementsByTagName("i8")[5].childNodes[0].nodeValue;
					aTorrent.peersConnected		= torrentNodes[i].getElementsByTagName("i8")[6].childNodes[0].nodeValue;
					aTorrent.peersNotConnected	= torrentNodes[i].getElementsByTagName("i8")[7].childNodes[0].nodeValue;
					aTorrent.peersAccounted		= torrentNodes[i].getElementsByTagName("i8")[8].childNodes[0].nodeValue;
					aTorrent.bytesDone			= torrentNodes[i].getElementsByTagName("i8")[9].childNodes[0].nodeValue;
					aTorrent.upTotal			= torrentNodes[i].getElementsByTagName("i8")[10].childNodes[0].nodeValue;
					aTorrent.creationDate		= torrentNodes[i].getElementsByTagName("i8")[11].childNodes[0].nodeValue;
					aTorrent.isComplete			= torrentNodes[i].getElementsByTagName("i8")[12].childNodes[0].nodeValue;
					aTorrent.ratio				= torrentNodes[i].getElementsByTagName("i8")[13].childNodes[0].nodeValue;
					aTorrent.isActive			= torrentNodes[i].getElementsByTagName("i8")[14].childNodes[0].nodeValue;

					CF.log("State: " + aTorrent.state);
				}

				// Add torrents to the list
				self.updateList();
			} else if (self.lastRequest == "listMethods") {
				CF.log("List of rTorrent XMLRPC methods:");
				var methodNodes = xmlDoc.getElementsByTagName("string");
				for (var i = 0; i<methodNodes.length; i++) {
					CF.log(methodNodes[i].childNodes[0].nodeValue);
				}
			}
		}
	};

	// Useful to see all the XML-RPC Commands in debugger
	self.listMethods = function () {
		var msg = new XMLRPCMessage("system.listMethods");

		self.buildSCGI(msg.xml(), "listMethods");
	};

	// Get a list of all torrents and their status
	self.listTorrents = function (torrentType) {
		var msg = new XMLRPCMessage("d.multicall");
		msg.addParameter(torrentType || "main"); // Default to "main" torrent type (all torrents)
		msg.addParameter("d.get_hash=");
		msg.addParameter("d.get_name=");
		msg.addParameter("d.get_state=");
		msg.addParameter("d.get_completed_bytes=");
		msg.addParameter("d.get_size_bytes=");
		msg.addParameter("d.get_left_bytes=");
		msg.addParameter("d.get_down_rate=");
		msg.addParameter("d.get_up_rate=");
		msg.addParameter("d.get_peers_connected=");
		msg.addParameter("d.get_peers_not_connected=");
		msg.addParameter("d.get_peers_accounted=");
		msg.addParameter("d.get_bytes_done=");
		msg.addParameter("d.get_up_total=");
		msg.addParameter("d.get_creation_date=");
		msg.addParameter("d.get_complete=");
		msg.addParameter("d.get_ratio=");
		msg.addParameter("d.is_active=");
		msg.addParameter("d.is_hash_checking=");
		msg.addParameter("d.is_multi_file=");

		self.buildSCGI(msg.xml(), "listTorrents");
	};
	
	// Use SCGI Syntax for the XML-RPC request
	self.buildSCGI = function (data, requestName) {
		var netString = "CONTENT_LENGTH\x00"+data.length+"\x00SCGI\x001\x00";
		data = netString.length+":"+netString+","+ data;

		// Set the flag so we know what data to parse on the response
		self.lastRequest = requestName;

		CF.send(self.systemName, data);
	};

	self.address = params.address || "192.168.0.250";
	self.port = parseInt(params.port) || 5000;
	self.systemName = params.systemName || "rTorrent";
	self.feedbackName = params.feedbackName || "rTorrent_Incoming";
	self.listJoin = params.listJoin || "l1";

	// Watch the system for feedback processing
	CF.watch(CF.FeedbackMatchedEvent, self.systemName, self.feedbackName, self.onIncomingData);

	return self;
}

// ======================================================================
// Create an instance of the rTorrent object
// ======================================================================
var rTorrent = new CFrTorrent({address: "192.168.0.250", port: "5000", systemName: "rTorrent", feedbackName: "rTorrent_Incoming", listJoin: "l1"});