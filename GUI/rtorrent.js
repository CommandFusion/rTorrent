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
		this.complete = 0;			// 0 = incomplete, 1 = complete
		this.ratio = 0;				// Download to Upload ratio for the torrent
		this.isActive = 0;			// 0 = inactive, 1 = active
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
				self.torrents = [];
				for (var i = 1; i<torrentNodes.length; i++) {
					var newTorrent = new Torrent();
					newTorrent.hash				= torrentNodes[i].getElementsByTagName("string")[0].childNodes[0].nodeValue;
					newTorrent.name				= torrentNodes[i].getElementsByTagName("string")[1].childNodes[0].nodeValue;
					newTorrent.state			= torrentNodes[i].getElementsByTagName("i8")[0].childNodes[0].nodeValue;
					newTorrent.bytesCompleted	= torrentNodes[i].getElementsByTagName("i8")[1].childNodes[0].nodeValue;
					newTorrent.bytesTotal		= torrentNodes[i].getElementsByTagName("i8")[2].childNodes[0].nodeValue;
					newTorrent.bytesRemain		= torrentNodes[i].getElementsByTagName("i8")[3].childNodes[0].nodeValue;
					newTorrent.mb				= newTorrent.BytesTotal/1024/1024;
					newTorrent.downRate			= torrentNodes[i].getElementsByTagName("i8")[4].childNodes[0].nodeValue;
					newTorrent.upRate			= torrentNodes[i].getElementsByTagName("i8")[5].childNodes[0].nodeValue;
					newTorrent.peersConnected	= torrentNodes[i].getElementsByTagName("i8")[6].childNodes[0].nodeValue;
					newTorrent.peersNotConnected = torrentNodes[i].getElementsByTagName("i8")[7].childNodes[0].nodeValue;
					newTorrent.peersAccounted	= torrentNodes[i].getElementsByTagName("i8")[8].childNodes[0].nodeValue;
					newTorrent.bytesDone		= torrentNodes[i].getElementsByTagName("i8")[9].childNodes[0].nodeValue;
					newTorrent.upTotal			= torrentNodes[i].getElementsByTagName("i8")[10].childNodes[0].nodeValue;
					newTorrent.creationDate		= torrentNodes[i].getElementsByTagName("i8")[11].childNodes[0].nodeValue;
					newTorrent.complete			= torrentNodes[i].getElementsByTagName("i8")[12].childNodes[0].nodeValue;
					newTorrent.ratio			= torrentNodes[i].getElementsByTagName("i8")[13].childNodes[0].nodeValue;
					newTorrent.isActive			= torrentNodes[i].getElementsByTagName("i8")[14].childNodes[0].nodeValue;
					
					self.torrents.push(newTorrent);

					CF.log("Active? " + newTorrent.isActive);
				}
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