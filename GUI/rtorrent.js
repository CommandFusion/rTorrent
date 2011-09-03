/* rTorrent module for CommandFusion
===============================================================================

AUTHOR:		Jarrod Bell, CommandFusion
CONTACT:	support@commandfusion.com
URL:		https://github.com/CommandFusion/rTorrent
VERSION:	v1.0.0
LAST MOD:	Saturday, 3 September 2011

=========================================================================
HELP:



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

var CFrTorrent = function(params) {
	var self = {
		address:		"",
		port:			0,
		systemName:		"",
		feedbackName:	"",
		torrents:		[],
		lastRequest:	"",
		incomingData:	""
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
	self.getTorrent = function(hash) {
		for (var i = 0, t; t = self.torrents[i]; i++) {
			if (t.hash === hash) {
				return t;
			}
		}  
		return null;
	};

	// Sort torrents by their status, then their name
	self.sortTorrents = function(a,b) {
		CF.log(a.isComplete);
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

	self.updateList = function() {
		CF.listRemove("l1");
		self.torrents.forEach (function(element, index, array) {
			CF.listAdd("l1", [{"s1": element.name, "a1": (65535/element.bytesTotal)*element.bytesCompleted, "s2": round((100/element.bytesTotal)*element.bytesCompleted, 1) + "%"}]);
		});
	};

	self.onIncomingData = function(theSystem, matchedString) {
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

					//CF.log("Active? " + aTorrent.isActive);
				}
				// Sort torrents by status, then name
				self.torrents.sort(self.sortTorrents);

				// Add torrents to the list
				self.updateList();

				CF.log(self.torrents.length);
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
	self.listMethods = function() {
		var msg = new XMLRPCMessage("system.listMethods");
		var netString = "CONTENT_LENGTH\x00"+msg.xml().length+"\x00SCGI\x001\x00";
		var bodyString = netString.length+":"+netString+","+ msg.xml();
		//CF.log(bodyString);

		// Set the flag so we know what data to parse on the response
		self.lastRequest = "listMethods";

		CF.send(self.systemName, bodyString);
	};

	// Get a list of all torrents and their status
	self.listTorrents = function(torrentType) {
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

		// Use SCGI Syntax for the XML-RPC request
		var netString = "CONTENT_LENGTH\x00"+msg.xml().length+"\x00SCGI\x001\x00";
		var bodyString = netString.length+":"+netString+","+ msg.xml();
		//CF.log(bodyString);

		// Set the flag so we know what data to parse on the response
		self.lastRequest = "listTorrents";

		CF.send(self.systemName, bodyString);
	};

	self.address = params.address || "192.168.0.250";
	self.port = parseInt(params.port) || 5000;
	self.systemName = params.systemName || "rTorrent";
	self.feedbackName = params.feedbackName || "rTorrent_Incoming";

	// Watch the system for feedback processing
	CF.watch(CF.FeedbackMatchedEvent, self.systemName, self.feedbackName, self.onIncomingData);

	return self;
}

// ======================================================================
// Create an instance of the rTorrent object
// ======================================================================
var rTorrent = new CFrTorrent({address: "192.168.0.250", port: "5000", systemName: "rTorrent", feedbackName: "rTorrent_Incoming"});