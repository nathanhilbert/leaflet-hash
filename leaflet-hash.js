(function(window) {
	var HAS_HASHCHANGE = (function() {
		var doc_mode = window.documentMode;
		return ('onhashchange' in window) &&
			(doc_mode === undefined || doc_mode > 7);
	})();

	L.Hash = function(map) {
		this.onHashChange = L.Util.bind(this.onHashChange, this);

		if (map) {
			this.init(map);
		}

		this.events = new Object();
	};

	L.Hash.parseHash = function(hash) {
		if(hash.indexOf('#') === 0) {
			hash = hash.substr(1);
		}
		var otherargs = hash.split("&");
		var returnset = {layers:[], mapattributes:{}};
		if (otherargs.length == 2){
			try{
				var setlayers = otherargs[1].split("=")[1].split(",");
				$.each(setlayers, function(index,value){
					returnset["layers"].push(value);
				});

			}
			catch(err){
				console.log("Hit the error -probably malformed hash:");
				console.log(err);
			}
		}
		var args = hash.split("/");
		if (args.length == 3) {
			var zoom = parseInt(args[0], 10),
			lat = parseFloat(args[1]),
			lon = parseFloat(args[2]);
			if (isNaN(zoom) || isNaN(lat) || isNaN(lon)) {
				return false;
			} else {
				returnset["mapattributes"] = {
					center: new L.LatLng(lat, lon),
					zoom: zoom
				};
			}
			return returnset;
		} else {
			return false;
		}
	};

	L.Hash.formatHash = function(map) {
		var center = map.getCenter(),
		    zoom = map.getZoom(),
		    precision = Math.max(0, Math.ceil(Math.log(zoom) / Math.LN2));


		var mapposition = "#" + [zoom,
			center.lat.toFixed(precision),
			center.lng.toFixed(precision)
		].join("/");
		if (!currentKey){
			return mapposition;
		}

		var layersettings = currentKey;

		return mapposition + "&layers=" + layersettings;


	},

	L.Hash.prototype = {
		map: null,
		lastHash: null,

		parseHash: L.Hash.parseHash,
		formatHash: L.Hash.formatHash,

		init: function(map) {
			this.map = map;

			// reset the hash
			this.lastHash = null;
			this.onHashChange();

			if (!this.isListening) {
				this.startListening();
			}
		},

		removeFrom: function(map) {
			if (this.changeTimeout) {
				clearTimeout(this.changeTimeout);
			}

			if (this.isListening) {
				this.stopListening();
			}

			this.map = null;
		},

		onMapMove: function() {
			// bail if we're moving the map (updating from a hash),
			// or if the map is not yet loaded

			if (this.movingMap || !this.map._loaded) {
				return false;
			}

			var hash = this.formatHash(this.map);
			if (this.events['change']) {
				for (var i=0; i<this.events['change'].length; i++) {
					hash = this.events['change'][i](hash);
				}
			}

			if (this.lastHash != hash) {
				document.location.replace(hash);
				this.lastHash = hash;
				if (this.events['hash']) {
					for (var i=0; i<this.events['hash'].length; i++) {
						this.events['hash'][i](hash);
					}
				}
			}
		},

		movingMap: false,
		update: function() {
			var hash = location.hash;
			if (hash === this.lastHash) {
				return;
			}
			var parsed = this.parseHash(hash);
			if (parsed) {
				this.movingMap = true;

				this.map.setView(parsed.mapattributes.center, parsed.mapattributes.zoom);

				//now turn on the layers that exist
				if (parsed['layers'].length > 0){



					//there will actually only be one layer
					//sublayers will be separated by the '+'
					$.each(parsed['layers'], function(index, value){
						//let's check if there is a sublayer to this
						try{
							var temparray = value.split("+");
							mainLayer = temparray[0];
							subLayer = temparray[1];
						}
						catch(err){
							var mainLayer = value;
						}
						if (subLayer){
							var mainClickCallbacker = function(){$("[name='" + subLayer + "']").trigger("click");}
							$("[name='" + mainLayer + "']").trigger('click', mainClickCallbacker);
						}
						else{
							$("[name='" + mainLayer + "']").trigger('click');
						}

					})
				}

				if (this.events['update']) {
					for (var i=0; i<this.events['update'].length; i++) {
						this.events['update'][i](hash);
					}
				}
				this.movingMap = false;
			} else {
				this.onMapMove(this.map);
			}
		},

		on: function(event, func) {
			if (! this.events[event]) {
				this.events[event] = [ func ];
			} else {
				this.events[event].push(func);
			}
		},
		off: function(event, func) {
			if (this.events[event]) {
				for (var i=0; i<this.events[event].length; i++) {
					if (this.events[event][i] == func) {
						this.events[event].splice(i);
						return;
					}
				}
			}
		},
		trigger: function(event) {
			if (event == "move") {
				if (! this.movingMap) {
					this.onMapMove();
				}
			}
		},
		// setMovingMap()/clearMovingMap() when making multiple changes that affect hash arguments
		//   ie when moving location and changing visible layers
		setMovingMap: function() {
			this.movingMap = true;
		},
		clearMovingMap: function() {
			this.movingMap = false;
		},
		// defer hash change updates every 100ms
		changeDefer: 100,
		changeTimeout: null,
		onHashChange: function() {
			// throttle calls to update() so that they only happen every
			// `changeDefer` ms
			if (!this.changeTimeout) {
				var that = this;
				this.changeTimeout = setTimeout(function() {
					that.update();
					that.changeTimeout = null;
				}, this.changeDefer);
			}
		},

		isListening: false,
		hashChangeInterval: null,
		startListening: function() {
			this.map.on("moveend", this.onMapMove, this);

			if (HAS_HASHCHANGE) {
				L.DomEvent.addListener(window, "hashchange", this.onHashChange);
			} else {
				clearInterval(this.hashChangeInterval);
				this.hashChangeInterval = setInterval(this.onHashChange, 50);
			}
			this.isListening = true;
		},

		stopListening: function() {
			this.map.off("moveend", this.onMapMove, this);

			if (HAS_HASHCHANGE) {
				L.DomEvent.removeListener(window, "hashchange", this.onHashChange);
			} else {
				clearInterval(this.hashChangeInterval);
			}
			this.isListening = false;
		}
	};
	L.hash = function(map) {
		return new L.Hash(map);
	};
	L.Map.prototype.addHash = function() {
		this._hash = L.hash(this);
	};
	L.Map.prototype.removeHash = function() {
		this._hash.removeFrom();
	};
})(window);
